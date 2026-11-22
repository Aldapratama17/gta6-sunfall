// Sunfall City - Police/Wanted system
// Wanted levels 1-5, police spawning, chase AI, evasion

import { POLICE, WORLD, VEHICLE } from './config.js';

export function createPoliceSystem(city, vehicles, audio) {
  const { maxStars, starDecay, crimes, response, chaseRange, giveUpRange, giveUpTime } = POLICE;
  const { blockSize, gridWidth, gridHeight, worldWidth, worldHeight } = WORLD;
  
  let wantedLevel = 0;
  let wantedStars = 0; // Visual stars (can flash)
  let starTimer = 0; // For star decay
  let flashTimer = 0;
  let lastCrimeTime = 0;
  
  // Police state
  const activePolice = []; // Police units currently chasing
  const roadblocks = [];
  let helicopter = null;
  let lastSpawnTime = 0;
  
  // Player reference (set externally)
  let player = null;
  
  function setPlayer(p) { player = p; }
  
  function reportCrime(crimeType) {
    const stars = crimes[crimeType] || 0;
    if (stars > 0) {
      addWanted(stars);
      lastCrimeTime = Date.now();
    }
  }
  
  function addWanted(amount) {
    wantedLevel = Math.min(maxStars, wantedLevel + amount);
    wantedStars = wantedLevel;
    starTimer = 0;
    flashTimer = 0.5;
    
    // Spawn police response
    spawnPoliceResponse();
    
    audio.playSiren(null);
  }
  
  function clearWanted() {
    wantedLevel = 0;
    wantedStars = 0;
    starTimer = 0;
    
    // Despawn police
    for (const pol of activePolice) {
      if (pol.veh) {
        pol.veh.aiState = 'flee';
        vehicles.removeVehicle(pol.veh);
      }
    }
    activePolice.length = 0;
    roadblocks.length = 0;
    if (helicopter) {
      helicopter.active = false;
      helicopter = null;
    }
    
    audio.playWantedDown();
  }
  
  function spawnPoliceResponse() {
    if (!player) return;
    
    const resp = response[wantedLevel] || response[maxStars];
    const now = Date.now();
    
    // Limit spawn rate
    if (now - lastSpawnTime < 3000) return;
    lastSpawnTime = now;
    
    // Spawn patrol cars
    for (let i = 0; i < resp.patrolCars; i++) {
      if (activePolice.length >= resp.patrolCars * 2) break;
      spawnPatrolCar(player);
    }
    
    // Helicopter at 4+
    if (wantedLevel >= 4 && !helicopter) {
      helicopter = {
        x: player.x,
        y: player.y - 500,
        angle: 0,
        active: true,
        spotlightAngle: 0
      };
      audio.playHeli();
    }
  }
  
  function spawnPatrolCar(target) {
    // Spawn on road near target but out of sight
    const angle = target.angle + Math.PI + (Math.random() - 0.5) * 1.0;
    const dist = 250 + Math.random() * 300;
    let x = target.x + Math.cos(angle) * dist;
    let y = target.y + Math.sin(angle) * dist;
    
    // Snap to nearest road
    let bestX = x, bestY = y, bestAngle = angle, bestDist = Infinity;
    
    const searchRadius = 5;
    const tbx = Math.floor(target.x / blockSize);
    const tby = Math.floor(target.y / blockSize);
    
    for (let by = Math.max(0, tby - searchRadius); by <= Math.min(gridHeight, tby + searchRadius); by++) {
      for (let bx = Math.max(0, tbx - searchRadius); bx <= Math.min(gridWidth, tbx + searchRadius); bx++) {
        // Check horizontal roads
        if (city.hRoads[by * gridWidth + bx] > 0) {
          const rx = bx * blockSize + blockSize / 2;
          const ry = by * blockSize;
          const d = Math.hypot(rx - x, ry - y);
          if (d < bestDist && d > 150) {
            bestDist = d;
            bestX = rx;
            bestY = ry;
            bestAngle = 0;
          }
        }
        // Check vertical roads
        if (city.vRoads[bx * gridHeight + by] > 0) {
          const rx = bx * blockSize;
          const ry = by * blockSize + blockSize / 2;
          const d = Math.hypot(rx - x, ry - y);
          if (d < bestDist && d > 150) {
            bestDist = d;
            bestX = rx;
            bestY = ry;
            bestAngle = Math.PI / 2;
          }
        }
      }
    }
    
    // Determine vehicle type based on wanted level
    let typeName = 'Patrol';
    if (wantedLevel >= 4) typeName = 'Interceptor';
    const typeData = VEHICLE.types.find(t => t.name === typeName) || VEHICLE.types[0];
    
    const veh = vehicles.createVehicle(typeData, bestX, bestY, bestAngle, false, false, true);
    veh.sirenOn = true;
    veh.lightsOn = true;
    veh.aiState = 'chase';
    veh.aiTarget = target;
    
    const policeUnit = {
      veh,
      spawnTime: Date.now(),
      lastShot: 0,
      state: 'chase'
    };
    
    activePolice.push(policeUnit);
    vehicles.spawnPolice = spawnPatrolCar; // Expose for external use
    audio.playSiren(veh);
  }
  
  function update(dt) {
    if (!player) return;
    
    // Star decay when not committing crimes
    if (wantedLevel > 0) {
      starTimer += dt;
      const decayRate = starDecay[wantedLevel - 1] || 0.1;
      
      // Only decay if no recent crimes and player not in sight of police
      let inSight = false;
      for (const pol of activePolice) {
        if (pol.veh) {
          const dx = pol.veh.x - player.x;
          const dy = pol.veh.y - player.y;
          if (Math.hypot(dx, dy) < chaseRange) {
            inSight = true;
            break;
          }
        }
      }
      
      if (!inSight && Date.now() - lastCrimeTime > 5000) {
        if (starTimer > 1 / decayRate) {
          wantedLevel = Math.max(0, wantedLevel - 1);
          wantedStars = wantedLevel;
          starTimer = 0;
          if (wantedLevel === 0) {
            clearWanted();
          } else {
            audio.playWantedDown();
          }
        }
      } else {
        starTimer = 0;
      }
    }
    
    // Flash stars when newly gained
    if (flashTimer > 0) {
      flashTimer -= dt;
      wantedStars = Math.floor(Date.now() / 100) % 2 === 0 ? wantedLevel : 0;
    } else {
      wantedStars = wantedLevel;
    }
    
    // Update police AI
    updatePoliceAI(dt);
    
    // Update helicopter
    if (helicopter && helicopter.active) {
      const dx = player.x - helicopter.x;
      const dy = player.y - helicopter.y;
      const dist = Math.hypot(dx, dy);
      
      // Follow player
      if (dist > 50) {
        helicopter.x += dx / dist * 100 * dt;
        helicopter.y += dy / dist * 100 * dt;
      }
      helicopter.angle = Math.atan2(dy, dx);
      helicopter.spotlightAngle = helicopter.angle;
    }
    
    // Update roadblocks
    for (let i = roadblocks.length - 1; i >= 0; i--) {
      const rb = roadblocks[i];
      rb.timer += dt;
      if (rb.timer > 60) { // Roadblocks last 60 seconds
        if (rb.veh) vehicles.removeVehicle(rb.veh);
        roadblocks.splice(i, 1);
      }
    }
    
    // Clean up dead/distant police
    for (let i = activePolice.length - 1; i >= 0; i--) {
      const pol = activePolice[i];
      if (!pol.veh || pol.veh.damage >= pol.veh.maxHealth) {
        activePolice.splice(i, 1);
        continue;
      }
      
      const dx = pol.veh.x - player.x;
      const dy = pol.veh.y - player.y;
      const dist = Math.hypot(dx, dy);
      
      // Despawn if too far and player not wanted
      if (dist > giveUpRange && wantedLevel === 0) {
        vehicles.removeVehicle(pol.veh);
        activePolice.splice(i, 1);
      }
    }
    
    // Spawn more police if needed
    const resp = response[wantedLevel] || response[maxStars];
    if (activePolice.length < resp.patrolCars && Date.now() - lastSpawnTime > 5000) {
      spawnPoliceResponse();
    }
  }
  
  function updatePoliceAI(dt) {
    for (const pol of activePolice) {
      const veh = pol.veh;
      if (!veh || veh.driver) continue;
      
      const dx = player.x - veh.x;
      const dy = player.y - veh.y;
      const dist = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx);
      
      // Steer towards player
      let angleDiff = targetAngle - veh.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      veh.steering = Math.max(-1, Math.min(1, angleDiff * 2.5));
      
      // Speed based on distance and wanted level
      if (dist > 100) {
        veh.targetSpeed = veh.typeData.maxSpeed;
      } else {
        veh.targetSpeed = veh.typeData.maxSpeed * 0.7;
      }
      
      // Shooting at 2+ stars
      const resp = response[wantedLevel] || response[maxStars];
      if (resp.shoot && dist < 250 && veh.aiState === 'chase') {
        pol.lastShot += dt;
        if (pol.lastShot > 1.5) {
          pol.lastShot = 0;
          // Police shoot - create bullet
          if (player.combat) {
            player.combat.createBullet({
              x: veh.x + Math.cos(veh.angle) * 20,
              y: veh.y + Math.sin(veh.angle) * 20,
              angle: targetAngle + (Math.random() - 0.5) * 0.15,
              speed: 600,
              damage: 15,
              range: 300,
              type: 'police_bullet',
              owner: veh
            });
          }
          audio.playGunshot(veh.x, veh.y, true);
        }
      }
      
      // Roadblock behavior
      if (veh.aiState === 'roadblock') {
        veh.targetSpeed = 0;
        veh.handbrake = true;
      }
    }
  }
  
  function addRoadblock(veh) {
    roadblocks.push({
      veh,
      timer: 0,
      x: veh.x,
      y: veh.y
    });
  }
  
  function getState() {
    return {
      wantedLevel,
      wantedStars,
      maxStars,
      activePolice: activePolice.length,
      hasHelicopter: !!helicopter,
      roadblocks: roadblocks.length
    };
  }
  
  return {
    setPlayer,
    reportCrime,
    addWanted,
    clearWanted,
    update,
    getState,
    get wantedLevel() { return wantedLevel; },
    get wantedStars() { return wantedStars; },
    get activePolice() { return activePolice; },
    get helicopter() { return helicopter; },
    get roadblocks() { return roadblocks; }
  };
}
