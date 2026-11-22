// Sunfall City - Player controller
// On-foot movement, vehicle enter/exit, sprint, camera

import { PLAYER, WORLD, VEHICLE } from './config.js';

export function createPlayer(city, vehicles, audio) {
  const { blockSize, worldWidth, worldHeight } = WORLD;
  
  // Start position - downtown
  let x = 3072, y = 3072;
  let angle = 0;
  let speed = 0;
  let sprintStamina = PLAYER.sprintStamina;
  let isSprinting = false;
  let health = PLAYER.maxHealth;
  let armor = 0;
  let ammo = 0;
  let hasGun = false;
  let fistCooldown = 0;
  let gunCooldown = 0;
  let invulnerable = 0;
  let wasted = false;
  let wastedTimer = 0;
  let currentVehicle = null;
  let vehicleSeat = 'driver'; // 'driver' or 'passenger'
  
  // Camera
  let camX = x, camY = y;
  let camLookAhead = 0;
  
  // Input state
  const input = {
    up: false, down: false, left: false, right: false,
    sprint: false, action: false, attack: false, pause: false
  };
  
  function setupInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') input.up = true;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = true;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
      else if (e.code === 'KeyE') input.action = true;
      else if (e.code === 'Space') input.attack = true;
      else if (e.code === 'Escape' || e.code === 'KeyP') input.pause = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') input.up = false;
      else if (e.code === 'KeyS' || e.code === 'ArrowDown') input.down = false;
      else if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
      else if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
      else if (e.code === 'KeyE') input.action = false;
      else if (e.code === 'Space') input.attack = false;
      else if (e.code === 'Escape' || e.code === 'KeyP') input.pause = false;
    });
    window.addEventListener('blur', () => {
      input.up = input.down = input.left = input.right = input.sprint = false;
      input.action = input.attack = false;
    });
    
    // Mouse for aiming
    window.addEventListener('mousemove', (e) => {
      if (currentVehicle) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    });
  }
  
  let canvas = null;
  function setCanvas(c) { canvas = c; }
  
  function enterVehicle(veh) {
    if (wasted || currentVehicle) return false;
    
    const dx = veh.x - x;
    const dy = veh.y - y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > PLAYER.enterCarRange) return false;
    
    // Check if driver seat free
    if (!veh.driver) {
      currentVehicle = veh;
      vehicleSeat = 'driver';
      veh.driver = player;
      x = veh.x;
      y = veh.y;
      angle = veh.angle;
      audio.playEnterCar();
      return true;
    }
    // Check passenger
    if (!veh.passenger && veh.typeData && veh.typeData.name !== 'Hauler') {
      currentVehicle = veh;
      vehicleSeat = 'passenger';
      veh.passenger = player;
      audio.playEnterCar();
      return true;
    }
    return false;
  }
  
  function exitVehicle() {
    if (!currentVehicle || vehicleSeat !== 'driver') return;
    
    const veh = currentVehicle;
    veh.driver = null;
    
    // Exit to side of vehicle
    const exitAngle = veh.angle + Math.PI / 2;
    x = veh.x + Math.cos(exitAngle) * (veh.typeData.w / 2 + PLAYER.radius + 4);
    y = veh.y + Math.sin(exitAngle) * (veh.typeData.w / 2 + PLAYER.radius + 4);
    
    // Clamp to world
    x = Math.max(PLAYER.radius, Math.min(worldWidth - PLAYER.radius, x));
    y = Math.max(PLAYER.radius, Math.min(worldHeight - PLAYER.radius, y));
    
    currentVehicle = null;
    vehicleSeat = 'driver';
    audio.playExitCar();
  }
  
  function takeDamage(amount, fromVehicle = false) {
    if (invulnerable > 0 || wasted) return false;
    
    let dmg = amount;
    if (armor > 0) {
      const absorb = Math.min(armor, dmg * 0.7);
      armor -= absorb;
      dmg -= absorb;
    }
    health -= dmg;
    
    if (health <= 0) {
      health = 0;
      wasted = true;
      wastedTimer = 0;
      audio.playWasted();
      if (currentVehicle) exitVehicle();
    } else {
      invulnerable = 0.3;
      audio.playHit();
    }
    return true;
  }
  
  function heal(amount) {
    health = Math.min(PLAYER.maxHealth, health + amount);
  }
  
  function addArmor(amount) {
    armor = Math.min(PLAYER.maxArmor, armor + amount);
  }
  
  function addAmmo(amount) {
    if (!hasGun) hasGun = true;
    ammo = Math.min(PLAYER.ammoCapacity, ammo + amount);
  }
  
  function giveGun() {
    hasGun = true;
    ammo = Math.max(ammo, 30);
  }
  
  function attack() {
    if (wasted || currentVehicle) return;
    if (fistCooldown > 0) return;
    
    fistCooldown = PLAYER.fistCooldown;
    audio.playPunch();
    
    // Check for peds/vehicles in range
    const range = PLAYER.fistRange;
    const attackX = x + Math.cos(angle) * range;
    const attackY = y + Math.sin(angle) * range;
    
    // Return attack data for world to process
    return { x: attackX, y: attackY, range, damage: PLAYER.fistDamage, type: 'fist' };
  }
  
  function shoot() {
    if (wasted || currentVehicle) return null;
    if (!hasGun || ammo <= 0) return null;
    if (gunCooldown > 0) return null;
    
    gunCooldown = PLAYER.gunCooldown;
    ammo--;
    if (ammo <= 0) hasGun = false;
    
    audio.playGunshot();
    
    return {
      x, y, angle,
      speed: 800,
      damage: PLAYER.gunDamage,
      range: PLAYER.gunRange,
      type: 'bullet'
    };
  }
  
  function respawn() {
    // Respawn at hospital/clinic - downtown
    x = 3072;
    y = 3072;
    angle = 0;
    health = PLAYER.maxHealth;
    armor = 0;
    wasted = false;
    wastedTimer = 0;
    invulnerable = PLAYER.respawnInvuln;
    sprintStamina = PLAYER.sprintStamina;
    if (currentVehicle) {
      currentVehicle.driver = null;
      currentVehicle = null;
    }
    audio.playRespawn();
  }
  
  function update(dt, peds, trafficVehicles) {
    if (wasted) {
      wastedTimer += dt;
      if (wastedTimer > 3.0) {
        respawn();
      }
      return;
    }
    
    // Cooldowns
    if (fistCooldown > 0) fistCooldown -= dt;
    if (gunCooldown > 0) gunCooldown -= dt;
    if (invulnerable > 0) invulnerable -= dt;
    
    if (currentVehicle) {
      // In vehicle - handled by vehicle system
      x = currentVehicle.x;
      y = currentVehicle.y;
      angle = currentVehicle.angle;
      return;
    }
    
    // On foot movement
    let moveX = 0, moveY = 0;
    if (input.up) moveY -= 1;
    if (input.down) moveY += 1;
    if (input.left) moveX -= 1;
    if (input.right) moveX += 1;
    
    const moveLen = Math.hypot(moveX, moveY);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveY /= moveLen;
      
      // Sprint
      const canSprint = input.sprint && sprintStamina > 0 && moveLen > 0;
      if (canSprint) {
        isSprinting = true;
        sprintStamina = Math.max(0, sprintStamina - PLAYER.sprintDrain * dt);
        speed = PLAYER.sprintSpeed;
      } else {
        isSprinting = false;
        sprintStamina = Math.min(PLAYER.sprintStamina, sprintStamina + PLAYER.sprintRegen * dt);
        speed = PLAYER.speed;
      }
      
      // Move
      const newX = x + moveX * speed * dt;
      const newY = y + moveY * speed * dt;
      
      // Collision with buildings
      const playerRadius = PLAYER.radius;
      let blocked = false;
      
      // Simple building collision - check nearby buildings
      for (const b of city.buildings) {
        // Expand building by player radius
        if (newX + playerRadius > b.x && newX - playerRadius < b.x + b.w &&
            newY + playerRadius > b.y && newY - playerRadius < b.y + b.h) {
          blocked = true;
          break;
        }
      }
      
      // Water collision
      for (const w of city.waterBodies) {
        if (newX + playerRadius > w.x && newX - playerRadius < w.x + w.w &&
            newY + playerRadius > w.y && newY - playerRadius < w.y + w.h) {
          blocked = true;
          break;
        }
      }
      
      if (!blocked) {
        x = Math.max(playerRadius, Math.min(worldWidth - playerRadius, newX));
        y = Math.max(playerRadius, Math.min(worldHeight - playerRadius, newY));
      }
      
      // Face movement direction when not aiming
      if (!hasGun || Math.abs(angle - Math.atan2(moveY, moveX)) > 0.1) {
        angle = Math.atan2(moveY, moveX);
      }
    } else {
      isSprinting = false;
      sprintStamina = Math.min(PLAYER.sprintStamina, sprintStamina + PLAYER.sprintRegen * dt);
    }
    
    // Camera follow with lookahead
    const targetCamX = x + Math.cos(angle) * camLookAhead;
    const targetCamY = y + Math.sin(angle) * camLookAhead;
    camLookAhead = Math.min(200, camLookAhead + (isSprinting ? 150 : 80) * dt);
    if (moveLen === 0) camLookAhead = Math.max(0, camLookAhead - 200 * dt);
    
    camX += (targetCamX - camX) * Math.min(1, dt * 8);
    camY += (targetCamY - camY) * Math.min(1, dt * 8);
    
    // Clamp camera to world
    const hw = WORLD.viewWidth / 2;
    const hh = WORLD.viewHeight / 2;
    camX = Math.max(hw, Math.min(worldWidth - hw, camX));
    camY = Math.max(hh, Math.min(worldHeight - hh, camY));
  }
  
  function getCamera() {
    return { x: camX, y: camY };
  }
  
  function getState() {
    return {
      x, y, angle, health, armor, ammo, hasGun,
      sprintStamina, maxStamina: PLAYER.sprintStamina,
      isSprinting, wasted, invulnerable,
      inVehicle: !!currentVehicle,
      vehicle: currentVehicle,
      vehicleSeat
    };
  }
  
  const player = {
    setupInput, setCanvas,
    enterVehicle, exitVehicle,
    takeDamage, heal, addArmor, addAmmo, giveGun,
    attack, shoot, respawn,
    update, getCamera, getState,
    get x() { return x; },
    get y() { return y; },
    get angle() { return angle; },
    get health() { return health; },
    get armor() { return armor; },
    get ammo() { return ammo; },
    get hasGun() { return hasGun; },
    get wasted() { return wasted; },
    get inVehicle() { return !!currentVehicle; },
    get currentVehicle() { return currentVehicle; },
    get input() { return input; }
  };
  
  return player;
}
