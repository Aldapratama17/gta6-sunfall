// Sunfall City - Vehicle system
// Car physics, traffic AI, parked cars, police vehicles

import { VEHICLE, WORLD, POLICE } from './config.js';

export function createVehicleSystem(city, audio) {
  const { blockSize, worldWidth, worldHeight, gridWidth, gridHeight } = WORLD;
  const { types, trafficDensity, trafficSpeed, trafficSpacing, parkedDensity } = VEHICLE;
  
  // All vehicles (player-driven, traffic, parked, police)
  const vehicles = [];
  const trafficVehicles = [];
  const parkedVehicles = [];
  const policeVehicles = [];
  
  // Traffic lanes - each road has lanes
  const trafficLanes = new Map(); // key: "x,y,dir" -> { vehicles: [], spawnTimer }
  
  function getTypeData(typeName) {
    return types.find(t => t.name === typeName) || types[0];
  }
  
  function getRandomCivilianType() {
    const civilianTypes = types.filter(t => t.weight > 0);
    const totalWeight = civilianTypes.reduce((sum, t) => sum + t.weight, 0);
    let r = Math.random() * totalWeight;
    for (const t of civilianTypes) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return civilianTypes[0];
  }
  
  function createVehicle(typeData, x, y, angle, isTraffic = false, isParked = false, isPolice = false) {
    const veh = {
      typeData,
      x, y, angle,
      speed: 0,
      targetSpeed: 0,
      steering: 0,
      handbrake: false,
      driver: null,
      passenger: null,
      isTraffic,
      isParked,
      isPolice,
      // AI
      aiState: 'drive', // 'drive', 'chase', 'flee', 'stop', 'roadblock'
      aiTarget: null,
      aiTimer: 0,
      laneOffset: 0,
      targetLane: 0,
      // Visual
      damage: 0,
      maxHealth: 1000,
      engineSound: null,
      sirenSound: null,
      sirenOn: false,
      lightsOn: false,
      // For traffic
      path: null,
      pathIndex: 0,
      stuckTimer: 0,
      lastPos: { x, y }
    };
    
    vehicles.push(veh);
    if (isTraffic) trafficVehicles.push(veh);
    if (isParked) parkedVehicles.push(veh);
    if (isPolice) policeVehicles.push(veh);
    
    return veh;
  }
  
  function removeVehicle(veh) {
    const idx = vehicles.indexOf(veh);
    if (idx >= 0) vehicles.splice(idx, 1);
    const tidx = trafficVehicles.indexOf(veh);
    if (tidx >= 0) trafficVehicles.splice(tidx, 1);
    const pidx = parkedVehicles.indexOf(veh);
    if (pidx >= 0) parkedVehicles.splice(pidx, 1);
    const polidx = policeVehicles.indexOf(veh);
    if (polidx >= 0) policeVehicles.splice(polidx, 1);
  }
  
  // Initialize parked cars along roads
  function initParkedCars() {
    for (let by = 0; by < gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        // Check horizontal roads
        const hRoad = city.hRoads[by * gridWidth + bx];
        if (hRoad > 0 && Math.random() < parkedDensity) {
          const typeData = getRandomCivilianType();
          const px = bx * blockSize + blockSize / 2 + (Math.random() - 0.5) * blockSize * 0.6;
          const py = by * blockSize + 16 + Math.random() * 16; // sidewalk side
          const angle = Math.random() < 0.5 ? 0 : Math.PI;
          createVehicle(typeData, px, py, angle, false, true);
        }
        if (hRoad > 0 && Math.random() < parkedDensity) {
          const typeData = getRandomCivilianType();
          const px = bx * blockSize + blockSize / 2 + (Math.random() - 0.5) * blockSize * 0.6;
          const py = (by + 1) * blockSize - 16 - Math.random() * 16;
          const angle = Math.random() < 0.5 ? 0 : Math.PI;
          createVehicle(typeData, px, py, angle, false, true);
        }
        
        // Check vertical roads
        const vRoad = city.vRoads[bx * gridHeight + by];
        if (vRoad > 0 && Math.random() < parkedDensity) {
          const typeData = getRandomCivilianType();
          const px = bx * blockSize + 16 + Math.random() * 16;
          const py = by * blockSize + blockSize / 2 + (Math.random() - 0.5) * blockSize * 0.6;
          const angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          createVehicle(typeData, px, py, angle, false, true);
        }
        if (vRoad > 0 && Math.random() < parkedDensity) {
          const typeData = getRandomCivilianType();
          const px = (bx + 1) * blockSize - 16 - Math.random() * 16;
          const py = by * blockSize + blockSize / 2 + (Math.random() - 0.5) * blockSize * 0.6;
          const angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          createVehicle(typeData, px, py, angle, false, true);
        }
      }
    }
  }
  
  // Initialize traffic lanes
  function initTrafficLanes() {
    for (let by = 0; by <= gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        const roadType = city.hRoads[by * gridWidth + bx];
        if (roadType > 0) {
          const lanes = roadType === 3 ? 4 : (roadType === 2 ? 2 : 1);
          for (let lane = 0; lane < lanes; lane++) {
            // Two directions per road
            trafficLanes.set(`h,${bx},${by},${lane},0`, { vehicles: [], spawnTimer: Math.random() * 5 });
            trafficLanes.set(`h,${bx},${by},${lane},1`, { vehicles: [], spawnTimer: Math.random() * 5 });
          }
        }
      }
    }
    for (let bx = 0; bx <= gridWidth; bx++) {
      for (let by = 0; by < gridHeight; by++) {
        const roadType = city.vRoads[bx * gridHeight + by];
        if (roadType > 0) {
          const lanes = roadType === 3 ? 4 : (roadType === 2 ? 2 : 1);
          for (let lane = 0; lane < lanes; lane++) {
            trafficLanes.set(`v,${bx},${by},${lane},0`, { vehicles: [], spawnTimer: Math.random() * 5 });
            trafficLanes.set(`v,${bx},${by},${lane},1`, { vehicles: [], spawnTimer: Math.random() * 5 });
          }
        }
      }
    }
  }
  
  function getLanePos(laneKey, progress) {
    const parts = laneKey.split(',');
    const type = parts[0];
    const bx = parseInt(parts[1]);
    const by = parseInt(parts[2]);
    const lane = parseInt(parts[3]);
    const dir = parseInt(parts[4]);
    
    const roadType = type === 'h' ? city.hRoads[by * gridWidth + bx] : city.vRoads[bx * gridHeight + by];
    const lanes = roadType === 3 ? 4 : (roadType === 2 ? 2 : 1);
    const laneWidth = 10;
    const roadWidth = lanes * laneWidth;
    const startOffset = (lane + 0.5) * laneWidth - roadWidth / 2;
    
    if (type === 'h') {
      const baseY = by * blockSize + startOffset;
      if (dir === 0) { // left to right
        return { x: bx * blockSize + progress * blockSize, y: baseY, angle: 0 };
      } else {
        return { x: (bx + 1) * blockSize - progress * blockSize, y: baseY, angle: Math.PI };
      }
    } else {
      const baseX = bx * blockSize + startOffset;
      if (dir === 0) { // top to bottom
        return { x: baseX, y: by * blockSize + progress * blockSize, angle: Math.PI / 2 };
      } else {
        return { x: baseX, y: (by + 1) * blockSize - progress * blockSize, angle: -Math.PI / 2 };
      }
    }
  }
  
  function spawnTrafficVehicle(laneKey, laneData) {
    const typeData = getRandomCivilianType();
    const pos = getLanePos(laneKey, 0);
    const veh = createVehicle(typeData, pos.x, pos.y, pos.angle, true);
    veh.laneKey = laneKey;
    veh.laneProgress = 0;
    veh.targetSpeed = typeData.maxSpeed * trafficSpeed * (0.8 + Math.random() * 0.4);
    laneData.vehicles.push(veh);
    return veh;
  }
  
  function updateTraffic(dt, player) {
    const playerPos = player ? { x: player.x, y: player.y } : null;
    
    for (const [laneKey, laneData] of trafficLanes) {
      // Spawn new traffic
      laneData.spawnTimer -= dt;
      if (laneData.spawnTimer <= 0 && laneData.vehicles.length < 3) {
        // Check if player is nearby - don't spawn right on top
        const pos = getLanePos(laneKey, 0);
        if (!playerPos || Math.hypot(pos.x - playerPos.x, pos.y - playerPos.y) > 300) {
          spawnTrafficVehicle(laneKey, laneData);
          laneData.spawnTimer = 3 + Math.random() * 5 / trafficDensity;
        } else {
          laneData.spawnTimer = 1;
        }
      }
      
      // Update each vehicle in lane
      for (let i = laneData.vehicles.length - 1; i >= 0; i--) {
        const veh = laneData.vehicles[i];
        if (!veh || veh.driver) { // Player took this car
          laneData.vehicles.splice(i, 1);
          continue;
        }
        
        veh.laneProgress += (veh.speed / blockSize) * dt;
        
        // Check if reached end of block
        if (veh.laneProgress >= 1) {
          veh.laneProgress -= 1;
          
          // Move to next block - find connected lane
          const parts = veh.laneKey.split(',');
          const type = parts[0];
          let bx = parseInt(parts[1]);
          let by = parseInt(parts[2]);
          const lane = parseInt(parts[3]);
          const dir = parseInt(parts[4]);
          
          if (type === 'h') {
            bx += dir === 0 ? 1 : -1;
          } else {
            by += dir === 0 ? 1 : -1;
          }
          
          // Check if road continues
          let nextRoadType = 0;
          if (type === 'h') {
            if (by >= 0 && by <= gridHeight && bx >= 0 && bx < gridWidth) {
              nextRoadType = city.hRoads[by * gridWidth + bx];
            }
          } else {
            if (bx >= 0 && bx <= gridWidth && by >= 0 && by < gridHeight) {
              nextRoadType = city.vRoads[bx * gridHeight + by];
            }
          }
          
          if (nextRoadType > 0) {
            const nextLanes = nextRoadType === 3 ? 4 : (nextRoadType === 2 ? 2 : 1);
            const nextLane = Math.min(lane, nextLanes - 1);
            veh.laneKey = `${type},${bx},${by},${nextLane},${dir}`;
            const nextLaneData = trafficLanes.get(veh.laneKey);
            if (nextLaneData) {
              laneData.vehicles.splice(i, 1);
              nextLaneData.vehicles.push(veh);
              continue;
            }
          }
          
          // Road ends - remove vehicle
          laneData.vehicles.splice(i, 1);
          removeVehicle(veh);
          continue;
        }
        
        // Update position
        const pos = getLanePos(veh.laneKey, veh.laneProgress);
        veh.x = pos.x;
        veh.y = pos.y;
        veh.angle = pos.angle;
        
        // Simple traffic AI - slow down for vehicles ahead
        const idx = laneData.vehicles.indexOf(veh);
        if (idx > 0) {
          const ahead = laneData.vehicles[idx - 1];
          const dist = Math.hypot(veh.x - ahead.x, veh.y - ahead.y);
          if (dist < 40) {
            veh.targetSpeed = Math.min(veh.targetSpeed, ahead.speed * 0.5);
          } else {
            veh.targetSpeed = veh.typeData.maxSpeed * trafficSpeed;
          }
        } else {
          veh.targetSpeed = veh.typeData.maxSpeed * trafficSpeed;
        }
        
        // Accelerate/brake
        const accel = veh.typeData.accel;
        if (veh.speed < veh.targetSpeed) {
          veh.speed = Math.min(veh.targetSpeed, veh.speed + accel * dt);
        } else {
          veh.speed = Math.max(veh.targetSpeed, veh.speed - accel * 2 * dt);
        }
        
        // Check for player nearby - react
        if (playerPos) {
          const dist = Math.hypot(veh.x - playerPos.x, veh.y - playerPos.y);
          if (dist < 80 && player.inVehicle && player.currentVehicle && player.currentVehicle.isPolice) {
            // Pull over for police
            veh.targetSpeed *= 0.3;
          }
        }
        
        // Stuck detection
        const moved = Math.hypot(veh.x - veh.lastPos.x, veh.y - veh.lastPos.y);
        if (moved < 0.5) {
          veh.stuckTimer += dt;
          if (veh.stuckTimer > 3) {
            // Try to change lane or respawn
            laneData.vehicles.splice(i, 1);
            removeVehicle(veh);
          }
        } else {
          veh.stuckTimer = 0;
          veh.lastPos.x = veh.x;
          veh.lastPos.y = veh.y;
        }
      }
    }
  }
  
  // Police vehicle spawning and AI
  function spawnPolice(wantedLevel, player) {
    if (!player || wantedLevel < 1) return;
    
    const response = POLICE.response[wantedLevel] || POLICE.response[5];
    const patrolType = wantedLevel >= 4 ? types.find(t => t.name === 'Interceptor') : types.find(t => t.name === 'Patrol');
    
    // Spawn behind player
    const angle = player.angle + Math.PI + (Math.random() - 0.5) * 0.5;
    const dist = 200 + Math.random() * 300;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    
    // Snap to nearest road
    let bestX = x, bestY = y, bestAngle = angle;
    let bestDist = Infinity;
    
    // Check nearby road positions
    for (let by = 0; by <= gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        if (city.hRoads[by * gridWidth + bx] > 0) {
          const rx = bx * blockSize + blockSize / 2;
          const ry = by * blockSize;
          const d = Math.hypot(rx - x, ry - y);
          if (d < bestDist) {
            bestDist = d;
            bestX = rx;
            bestY = ry;
            bestAngle = 0;
          }
        }
      }
    }
    
    const veh = createVehicle(patrolType, bestX, bestY, bestAngle, false, false, true);
    veh.sirenOn = true;
    veh.lightsOn = true;
    veh.aiState = 'chase';
    veh.aiTarget = player;
    audio.playSiren(veh);
    
    // Spawn roadblock ahead at 3+ stars
    if (wantedLevel >= 3 && Math.random() < POLICE.roadblockDistance) {
      spawnRoadblock(player);
    }
  }
  
  function spawnRoadblock(player) {
    const angle = player.angle;
    const dist = 300 + Math.random() * 200;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    
    const typeData = types.find(t => t.name === 'Hauler');
    const veh = createVehicle(typeData, x, y, angle + Math.PI / 2, false, false, true);
    veh.aiState = 'roadblock';
    veh.sirenOn = true;
    veh.lightsOn = true;
  }
  
  function updatePolice(dt, player) {
    for (const veh of policeVehicles) {
      if (veh.driver || veh.damage >= veh.maxHealth) continue;
      
      if (veh.aiState === 'chase' && player) {
        const dx = player.x - veh.x;
        const dy = player.y - veh.y;
        const dist = Math.hypot(dx, dy);
        const targetAngle = Math.atan2(dy, dx);
        
        // Steer towards player
        let angleDiff = targetAngle - veh.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        veh.steering = Math.max(-1, Math.min(1, angleDiff * 2));
        veh.targetSpeed = veh.typeData.maxSpeed;
        
        // Shoot at 2+ stars
        if (player.wantedLevel >= 2 && dist < 300 && Math.random() < 0.02) {
          // Police shooting handled in combat system
        }
        
        // Give up if too far
        if (dist > POLICE.giveUpRange) {
          veh.aiTimer += dt;
          if (veh.aiTimer > POLICE.giveUpTime) {
            removeVehicle(veh);
          }
        } else {
          veh.aiTimer = 0;
        }
      } else if (veh.aiState === 'roadblock') {
        veh.targetSpeed = 0;
        veh.handbrake = true;
      }
      
      // Physics update
      updateVehiclePhysics(veh, dt);
    }
  }
  
  // Vehicle physics
  function updateVehiclePhysics(veh, dt) {
    if (veh.isParked && !veh.driver) return;
    
    const typeData = veh.typeData;
    
    // Engine
    if (veh.driver) {
      // Player controlled
      const input = veh.driver.input;
      let accel = 0;
      if (input.up) accel = 1;
      if (input.down) accel = -0.7;
      
      if (input.left) veh.steering = Math.max(-1, veh.steering - dt * 3);
      else if (input.right) veh.steering = Math.min(1, veh.steering + dt * 3);
      else veh.steering *= 0.9;
      
      veh.handbrake = input.attack; // Space = handbrake in vehicle
      
      if (accel > 0) {
        veh.speed += typeData.accel * accel * dt;
      } else if (accel < 0) {
        veh.speed += typeData.accel * accel * dt;
      } else {
        // Coast
        veh.speed *= 0.98;
      }
      
      // Exit vehicle
      if (input.action) {
        veh.driver.exitVehicle();
      }
    } else if (veh.isTraffic) {
      // Traffic AI handled in updateTraffic
    } else if (veh.isPolice) {
      // Police AI handled in updatePolice
    }
    
    // Clamp speed
    const maxSpeed = typeData.maxSpeed;
    if (veh.speed > maxSpeed) veh.speed = maxSpeed;
    if (veh.speed < -maxSpeed * 0.3) veh.speed = -maxSpeed * 0.3;
    
    // Turning
    let turnRate = typeData.turn * (veh.speed / maxSpeed);
    if (veh.handbrake && Math.abs(veh.speed) > 10) {
      turnRate = typeData.hbTurn * (veh.speed / maxSpeed);
      veh.speed *= 0.95;
    }
    veh.angle += veh.steering * turnRate * dt;
    
    // Move
    const newX = veh.x + Math.cos(veh.angle) * veh.speed * dt;
    const newY = veh.y + Math.sin(veh.angle) * veh.speed * dt;
    
    // Collision with buildings
    const hw = typeData.w / 2;
    const hl = typeData.l / 2;
    let blocked = false;
    
    // Check building collision (simplified - check corners)
    const corners = [
      { x: newX + Math.cos(veh.angle) * hl - Math.sin(veh.angle) * hw, y: newY + Math.sin(veh.angle) * hl + Math.cos(veh.angle) * hw },
      { x: newX + Math.cos(veh.angle) * hl + Math.sin(veh.angle) * hw, y: newY + Math.sin(veh.angle) * hl - Math.cos(veh.angle) * hw },
      { x: newX - Math.cos(veh.angle) * hl - Math.sin(veh.angle) * hw, y: newY - Math.sin(veh.angle) * hl + Math.cos(veh.angle) * hw },
      { x: newX - Math.cos(veh.angle) * hl + Math.sin(veh.angle) * hw, y: newY - Math.sin(veh.angle) * hl - Math.cos(veh.angle) * hw },
    ];
    
    for (const corner of corners) {
      for (const b of city.buildings) {
        if (corner.x > b.x - 4 && corner.x < b.x + b.w + 4 &&
            corner.y > b.y - 4 && corner.y < b.y + b.h + 4) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      
      // Water collision
      for (const w of city.waterBodies) {
        if (corner.x > w.x && corner.x < w.x + w.w &&
            corner.y > w.y && corner.y < w.y + w.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;
    }
    
    // Vehicle-vehicle collision (simple)
    if (!blocked) {
      for (const other of vehicles) {
        if (other === veh || other.isParked) continue;
        const dx = newX - other.x;
        const dy = newY - other.y;
        const dist = Math.hypot(dx, dy);
        const minDist = (typeData.w + other.typeData.w) / 2 + 4;
        if (dist < minDist) {
          blocked = true;
          // Push apart
          if (dist > 0) {
            veh.x += dx / dist * (minDist - dist) * 0.5;
            veh.y += dy / dist * (minDist - dist) * 0.5;
          }
          break;
        }
      }
    }
    
    if (!blocked) {
      veh.x = Math.max(hw, Math.min(worldWidth - hw, newX));
      veh.y = Math.max(hl, Math.min(worldHeight - hl, newY));
    } else {
      veh.speed *= 0.5;
      // Damage on hard impact
      if (Math.abs(veh.speed) > 50) {
        veh.damage += Math.abs(veh.speed) * 0.1;
      }
    }
    
    // Engine sound
    if (veh.driver || veh.isPolice) {
      const rpm = Math.abs(veh.speed) / maxSpeed;
      audio.updateEngineSound(veh, rpm);
    }
    if (veh.sirenOn) {
      audio.updateSirenSound(veh);
    }
  }
  
  function update(dt, player) {
    updateTraffic(dt, player);
    updatePolice(dt, player);
    
    // Update all vehicles physics
    for (const veh of vehicles) {
      updateVehiclePhysics(veh, dt);
    }
    
    // Clean up destroyed vehicles
    for (let i = vehicles.length - 1; i >= 0; i--) {
      if (vehicles[i].damage >= vehicles[i].maxHealth) {
        if (vehicles[i].driver) vehicles[i].driver.exitVehicle();
        audio.playExplosion(vehicles[i].x, vehicles[i].y);
        removeVehicle(vehicles[i]);
      }
    }
  }
  
  function getNearbyVehicles(x, y, radius) {
    const result = [];
    for (const veh of vehicles) {
      if (veh.isParked) continue;
      const dx = veh.x - x;
      const dy = veh.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        result.push(veh);
      }
    }
    return result;
  }
  
  function getVehicleAt(x, y, radius = 40) {
    for (const veh of vehicles) {
      const dx = veh.x - x;
      const dy = veh.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        return veh;
      }
    }
    return null;
  }
  
  // Initialize
  initParkedCars();
  initTrafficLanes();
  
  return {
    vehicles,
    trafficVehicles,
    parkedVehicles,
    policeVehicles,
    createVehicle,
    removeVehicle,
    spawnPolice,
    update,
    getNearbyVehicles,
    getVehicleAt,
    getTypeData
  };
}
