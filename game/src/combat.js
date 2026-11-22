// Sunfall City - Combat system
// Fist fights, gunplay, health/armor, pickups, wasted/busted states

import { COMBAT, PLAYER, WORLD, PED } from './config.js';

export function createCombatSystem(city, player, peds, vehicles, police, audio, particles) {
  const { bulletSpeed, bulletLifetime, bulletRadius, muzzleFlashTime, 
          bloodParticles, bloodLifetime, gunPickupAmmo, healthPickupAmount, 
          armorPickupAmount, pickupRadius, pickupRespawn } = COMBAT;
  const { worldWidth, worldHeight } = WORLD;
  
  // Bullets
  const bullets = [];
  
  // Pickups
  const pickups = [];
  
  // Muzzle flashes
  const muzzleFlashes = [];
  
  // Player reference for busted state
  let busted = false;
  let bustedTimer = 0;
  
  function createBullet(data) {
    const bullet = {
      x: data.x,
      y: data.y,
      angle: data.angle,
      speed: data.speed || bulletSpeed,
      damage: data.damage || PLAYER.gunDamage,
      range: data.range || PLAYER.gunRange,
      type: data.type || 'bullet',
      owner: data.owner || player,
      lifetime: 0,
      maxLifetime: bulletLifetime,
      traveled: 0
    };
    bullets.push(bullet);
    return bullet;
  }
  
  function createPickup(type, x, y) {
    const pickup = {
      type, // 'gun', 'health', 'armor'
      x, y,
      angle: Math.random() * Math.PI * 2,
      bobOffset: Math.random() * Math.PI * 2,
      respawnTimer: 0,
      collected: false
    };
    pickups.push(pickup);
    return pickup;
  }
  
  function initPickups() {
    // Place some initial pickups around the city
    const locations = [
      { x: 3072, y: 2800, type: 'gun' }, // Docks
      { x: 3600, y: 3400, type: 'health' }, // Chop shop
      { x: 1200, y: 5200, type: 'armor' }, // Warehouse
      { x: 5200, y: 1800, type: 'gun' }, // Marina
      { x: 3000, y: 2900, type: 'health' }, // Bank
      { x: 2600, y: 3200, type: 'armor' }, // Safehouse
      { x: 1400, y: 5000, type: 'gun' }, // Industrial
      { x: 4800, y: 4800, type: 'health' }, // Beach
    ];
    
    for (const loc of locations) {
      // Find nearby sidewalk/road
      let placed = false;
      for (let i = 0; i < 10; i++) {
        const px = loc.x + (Math.random() - 0.5) * 100;
        const py = loc.y + (Math.random() - 0.5) * 100;
        if (px > 0 && px < worldWidth && py > 0 && py < worldHeight) {
          // Check not in building
          let inBuilding = false;
          for (const b of city.buildings) {
            if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) {
              inBuilding = true; break;
            }
          }
          if (!inBuilding) {
            createPickup(loc.type, px, py);
            placed = true;
            break;
          }
        }
      }
    }
  }
  
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.lifetime += dt;
      b.traveled += b.speed * dt;
      
      if (b.lifetime > b.maxLifetime || b.traveled > b.range) {
        bullets.splice(i, 1);
        continue;
      }
      
      // Move bullet
      const newX = b.x + Math.cos(b.angle) * b.speed * dt;
      const newY = b.y + Math.sin(b.angle) * b.speed * dt;
      
      // Check collision with buildings
      let hitBuilding = false;
      for (const building of city.buildings) {
        if (newX > building.x && newX < building.x + building.w &&
            newY > building.y && newY < building.y + building.h) {
          hitBuilding = true;
          // Spark particles
          if (particles) particles.createSparks(newX, newY, b.angle);
          break;
        }
      }
      
      if (hitBuilding) {
        bullets.splice(i, 1);
        continue;
      }
      
      // Check collision with vehicles
      let hitVehicle = false;
      for (const veh of vehicles.vehicles) {
        if (veh === b.owner) continue;
        if (veh.isParked) continue;
        const dx = newX - veh.x;
        const dy = newY - veh.y;
        const dist = Math.hypot(dx, dy);
        const vehRadius = (veh.typeData.w + veh.typeData.l) / 4;
        if (dist < vehRadius + bulletRadius) {
          hitVehicle = true;
          veh.damage += b.damage;
          if (particles) particles.createSparks(newX, newY, b.angle + Math.PI);
          
          // If police vehicle, increase wanted
          if (veh.isPolice && b.owner === player) {
            police.reportCrime('shootCop');
          }
          break;
        }
      }
      
      if (hitVehicle) {
        bullets.splice(i, 1);
        continue;
      }
      
      // Check collision with peds
      let hitPed = false;
      for (const ped of peds.peds) {
        if (ped.isDead) continue;
        const dx = newX - ped.x;
        const dy = newY - ped.y;
        const dist = Math.hypot(dx, dy);
        if (dist < PED.radius + bulletRadius) {
          hitPed = true;
          ped.health -= b.damage;
          
          // Blood particles
          if (particles) {
            for (let j = 0; j < bloodParticles; j++) {
              particles.createBlood(newX, newY, b.angle + (Math.random() - 0.5) * 0.5);
            }
          }
          
          if (ped.health <= 0) {
            ped.isDead = true;
            ped.panicTimer = 5.0;
            audio.playPedDeath();
            
            // Mission progress
            if (player.missions) player.missions.onPedKilled(ped, b.owner === player);
            
            // Crime
            if (b.owner === player) {
              police.reportCrime('killPedestrian');
            }
          } else {
            ped.state = 'panic';
            ped.panicTimer = PED.panicTime;
            ped.lastSeenThreat = { x: b.owner.x, y: b.owner.y };
          }
          break;
        }
      }
      
      if (hitPed) {
        bullets.splice(i, 1);
        continue;
      }
      
      // Check collision with player (enemy bullets)
      if (b.owner !== player && !player.inVehicle && !player.wasted) {
        const dx = newX - player.x;
        const dy = newY - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < PLAYER.radius + bulletRadius) {
          player.takeDamage(b.damage);
          if (particles) {
            for (let j = 0; j < bloodParticles; j++) {
              particles.createBlood(newX, newY, b.angle + (Math.random() - 0.5) * 0.5);
            }
          }
          bullets.splice(i, 1);
          continue;
        }
      }
      
      b.x = newX;
      b.y = newY;
    }
  }
  
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      
      if (p.collected) {
        p.respawnTimer += dt;
        if (p.respawnTimer > pickupRespawn) {
          p.collected = false;
          p.respawnTimer = 0;
          p.bobOffset = Math.random() * Math.PI * 2;
        }
        continue;
      }
      
      // Bob animation
      p.angle += dt;
      p.bobOffset += dt * 2;
      
      // Check player pickup
      if (!player.wasted && !player.inVehicle) {
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < pickupRadius + PLAYER.radius) {
          collectPickup(p);
        }
      }
    }
  }
  
  function collectPickup(p) {
    p.collected = true;
    audio.playPickup();
    
    switch (p.type) {
      case 'gun':
        player.giveGun();
        player.addAmmo(gunPickupAmmo);
        break;
      case 'health':
        player.heal(healthPickupAmount);
        break;
      case 'armor':
        player.addArmor(armorPickupAmount);
        break;
    }
    
    if (particles) {
      for (let i = 0; i < 10; i++) {
        particles.createPickupEffect(p.x, p.y, p.type);
      }
    }
  }
  
  function updateMuzzleFlashes(dt) {
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
      const f = muzzleFlashes[i];
      f.timer += dt;
      if (f.timer > muzzleFlashTime) {
        muzzleFlashes.splice(i, 1);
      }
    }
  }
  
  function addMuzzleFlash(x, y, angle) {
    muzzleFlashes.push({ x, y, angle, timer: 0 });
  }
  
  function playerAttack() {
    if (player.wasted || player.inVehicle) return null;
    return player.attack();
  }
  
  function playerShoot() {
    if (player.wasted || player.inVehicle) return null;
    const bullet = player.shoot();
    if (bullet) {
      player.lastGunshotTime = Date.now();
      createBullet(bullet);
      addMuzzleFlash(bullet.x, bullet.y, bullet.angle);
      police.reportCrime('shootGun');
    }
    return bullet;
  }
  
  function checkBusted() {
    // Player is busted if on foot and police very close at wanted level
    if (player.inVehicle || player.wasted || busted) return;
    if (police.wantedLevel === 0) return;
    
    for (const pol of police.activePolice) {
      if (!pol.veh) continue;
      const dx = pol.veh.x - player.x;
      const dy = pol.veh.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30 && Math.abs(pol.veh.speed) < 20) {
        // Busted!
        busted = true;
        bustedTimer = 0;
        audio.playBusted();
        // Lose money, weapons
        player.addMoney(-Math.floor(player.money * 0.1));
        player.hasGun = false;
        player.ammo = 0;
        break;
      }
    }
  }
  
  function updateBusted(dt) {
    if (!busted) return;
    bustedTimer += dt;
    if (bustedTimer > 3.0) {
      busted = false;
      // Respawn at police station
      player.x = 3400;
      player.y = 2400;
      player.health = PLAYER.maxHealth;
      player.armor = 0;
      player.wasted = false;
      audio.playRespawn();
    }
  }
  
  function applyExplosion(x, y, radius, damage, owner) {
    // Damage vehicles
    for (const veh of vehicles.vehicles) {
      const dx = veh.x - x;
      const dy = veh.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        veh.damage += damage * (1 - dist / radius);
      }
    }
    
    // Damage peds
    peds.applyExplosion(x, y, radius, damage);
    
    // Damage player
    if (!player.inVehicle && !player.wasted) {
      const dx = player.x - x;
      const dy = player.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        player.takeDamage(damage * (1 - dist / radius));
      }
    }
  }
  
  function update(dt) {
    updateBullets(dt);
    updatePickups(dt);
    updateMuzzleFlashes(dt);
    checkBusted();
    updateBusted(dt);
  }
  
  function getBullets() { return bullets; }
  function getPickups() { return pickups; }
  function getMuzzleFlashes() { return muzzleFlashes; }
  function getBusted() { return busted; }
  
  initPickups();
  
  return {
    update,
    createBullet,
    createPickup,
    playerAttack,
    playerShoot,
    applyExplosion,
    getBullets,
    getPickups,
    getMuzzleFlashes,
    getBusted,
    get busted() { return busted; }
  };
}
