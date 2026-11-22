// Sunfall City - Pedestrian system
// Pedestrian AI walking sidewalks, fleeing when scared

import { PED, WORLD } from './config.js';

export function createPedSystem(city, audio, police) {
  const { blockSize, gridWidth, gridHeight, worldWidth, worldHeight } = WORLD;
  const { radius, walkSpeed, runSpeed, fleeSpeed, sidewalkMargin, density, viewRange, hearRange, panicTime, types } = PED;
  
  const peds = [];
  const sidewalkNodes = []; // Precomputed sidewalk waypoints
  
  function getRandomPedType() {
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    let r = Math.random() * totalWeight;
    for (const t of types) {
      r -= t.weight;
      if (r <= 0) return t;
    }
    return types[0];
  }
  
  function isSidewalk(worldX, worldY) {
    // Check if position is on a sidewalk (road edge)
    const bx = Math.floor(worldX / blockSize);
    const by = Math.floor(worldY / blockSize);
    const inBlockX = (worldX % blockSize) / blockSize;
    const inBlockY = (worldY % blockSize) / blockSize;
    const margin = sidewalkMargin / blockSize;
    
    // Must be on a road block
    let onRoad = false;
    if (by > 0 && city.hRoads[by * gridWidth + bx] > 0) onRoad = true;
    if (by < gridHeight && city.hRoads[(by + 1) * gridWidth + bx] > 0) onRoad = true;
    if (bx > 0 && city.vRoads[bx * gridHeight + by] > 0) onRoad = true;
    if (bx < gridWidth && city.vRoads[(bx + 1) * gridHeight + by] > 0) onRoad = true;
    
    if (!onRoad) return false;
    
    // Must be at edge of block (sidewalk)
    return inBlockX < margin || inBlockX > 1 - margin || inBlockY < margin || inBlockY > 1 - margin;
  }
  
  function findNearestSidewalk(x, y, maxDist = 100) {
    let bestX = x, bestY = y, bestDist = Infinity;
    
    for (let dx = -maxDist; dx <= maxDist; dx += blockSize / 2) {
      for (let dy = -maxDist; dy <= maxDist; dy += blockSize / 2) {
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || tx >= worldWidth || ty < 0 || ty >= worldHeight) continue;
        if (isSidewalk(tx, ty)) {
          const d = Math.hypot(tx - x, ty - y);
          if (d < bestDist) {
            bestDist = d;
            bestX = tx;
            bestY = ty;
          }
        }
      }
    }
    
    return bestDist < Infinity ? { x: bestX, y: bestY } : null;
  }
  
  function generateSidewalkNodes() {
    sidewalkNodes.length = 0;
    
    // Generate nodes along road edges
    for (let by = 0; by <= gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        if (city.hRoads[by * gridWidth + bx] > 0) {
          // Top sidewalk
          for (let i = 0; i < 4; i++) {
            const x = bx * blockSize + (i + 0.5) * blockSize / 4;
            const y = by * blockSize + sidewalkMargin;
            if (!isBuildingAt(x, y)) sidewalkNodes.push({ x, y, connections: [] });
          }
          // Bottom sidewalk
          for (let i = 0; i < 4; i++) {
            const x = bx * blockSize + (i + 0.5) * blockSize / 4;
            const y = (by + 1) * blockSize - sidewalkMargin;
            if (!isBuildingAt(x, y)) sidewalkNodes.push({ x, y, connections: [] });
          }
        }
      }
    }
    
    for (let bx = 0; bx <= gridWidth; bx++) {
      for (let by = 0; by < gridHeight; by++) {
        if (city.vRoads[bx * gridHeight + by] > 0) {
          // Left sidewalk
          for (let i = 0; i < 4; i++) {
            const x = bx * blockSize + sidewalkMargin;
            const y = by * blockSize + (i + 0.5) * blockSize / 4;
            if (!isBuildingAt(x, y)) sidewalkNodes.push({ x, y, connections: [] });
          }
          // Right sidewalk
          for (let i = 0; i < 4; i++) {
            const x = (bx + 1) * blockSize - sidewalkMargin;
            const y = by * blockSize + (i + 0.5) * blockSize / 4;
            if (!isBuildingAt(x, y)) sidewalkNodes.push({ x, y, connections: [] });
          }
        }
      }
    }
    
    // Connect nearby nodes
    for (let i = 0; i < sidewalkNodes.length; i++) {
      const a = sidewalkNodes[i];
      for (let j = i + 1; j < sidewalkNodes.length; j++) {
        const b = sidewalkNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < blockSize * 0.6) {
          a.connections.push({ node: b, dist });
          b.connections.push({ node: a, dist });
        }
      }
    }
  }
  
  function isBuildingAt(x, y) {
    for (const b of city.buildings) {
      if (x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4) {
        return true;
      }
    }
    return false;
  }
  
  function createPed(x, y) {
    const type = getRandomPedType();
    const sidewalk = findNearestSidewalk(x, y, 50);
    if (!sidewalk) return null;
    
    const ped = {
      type,
      x: sidewalk.x,
      y: sidewalk.y,
      targetX: sidewalk.x,
      targetY: sidewalk.y,
      angle: Math.random() * Math.PI * 2,
      speed: 0,
      state: 'walk', // 'walk', 'idle', 'flee', 'panic'
      panicTimer: 0,
      currentNode: null,
      path: [],
      pathIndex: 0,
      health: 50,
      maxHealth: 50,
      isDead: false,
      lastSeenThreat: null,
      wanderTimer: Math.random() * 5
    };
    
    // Pick random sidewalk node as initial target
    if (sidewalkNodes.length > 0) {
      ped.currentNode = sidewalkNodes[Math.floor(Math.random() * sidewalkNodes.length)];
      pickNewTarget(ped);
    }
    
    peds.push(ped);
    return ped;
  }
  
  function pickNewTarget(ped) {
    if (!ped.currentNode || ped.currentNode.connections.length === 0) return;
    
    // Random walk - pick connected node
    const conn = ped.currentNode.connections[Math.floor(Math.random() * ped.currentNode.connections.length)];
    ped.targetX = conn.node.x + (Math.random() - 0.5) * 8;
    ped.targetY = conn.node.y + (Math.random() - 0.5) * 8;
    ped.currentNode = conn.node;
  }
  
  function initPeds() {
    generateSidewalkNodes();
    
    // Spawn initial peds across the city
    const spawnCount = Math.floor(worldWidth * worldHeight / blockSize / blockSize * density * 100);
    for (let i = 0; i < spawnCount; i++) {
      const x = Math.random() * worldWidth;
      const y = Math.random() * worldHeight;
      createPed(x, y);
    }
  }
  
  function update(dt, player, vehicles) {
    const playerPos = player ? { x: player.x, y: player.y } : null;
    const playerInVehicle = player ? player.inVehicle : false;
    const playerVehicle = player ? player.currentVehicle : null;
    const playerWanted = player ? player.wantedLevel : 0;
    
    for (let i = peds.length - 1; i >= 0; i--) {
      const ped = peds[i];
      
      if (ped.isDead) {
        ped.panicTimer -= dt;
        if (ped.panicTimer <= 0) {
          peds.splice(i, 1);
        }
        continue;
      }
      
      // Check for threats
      let threat = null;
      let threatDist = Infinity;
      
      // Player on foot
      if (playerPos && !playerInVehicle) {
        const dx = playerPos.x - ped.x;
        const dy = playerPos.y - ped.y;
        const dist = Math.hypot(dx, dy);
        if (dist < viewRange) {
          // Check if player has weapon or is attacking
          if (player.hasGun || player.attacking) {
            threat = { x: playerPos.x, y: playerPos.y, type: 'player' };
            threatDist = dist;
          } else if (dist < 50 && playerWanted > 0) {
            // Flee from wanted player
            threat = { x: playerPos.x, y: playerPos.y, type: 'player_wanted' };
            threatDist = dist;
          }
        }
      }
      
      // Player in vehicle
      if (playerInVehicle && playerVehicle) {
        const dx = playerVehicle.x - ped.x;
        const dy = playerVehicle.y - ped.y;
        const dist = Math.hypot(dx, dy);
        if (dist < hearRange && Math.abs(playerVehicle.speed) > 50) {
          threat = { x: playerVehicle.x, y: playerVehicle.y, type: 'vehicle' };
          threatDist = dist;
        }
        // Vehicle very close and fast = panic
        if (dist < 30 && Math.abs(playerVehicle.speed) > 100) {
          threat = { x: playerVehicle.x, y: playerVehicle.y, type: 'vehicle_fast' };
          threatDist = dist;
        }
      }
      
      // Police vehicles
      for (const veh of vehicles) {
        if (!veh.isPolice || veh.sirenOn === false) continue;
        const dx = veh.x - ped.x;
        const dy = veh.y - ped.y;
        const dist = Math.hypot(dx, dy);
        if (dist < hearRange) {
          threat = { x: veh.x, y: veh.y, type: 'police' };
          threatDist = dist;
        }
      }
      
      // Gunshots nearby
      if (player && player.lastGunshotTime && Date.now() - player.lastGunshotTime < 2000) {
        if (playerPos) {
          const dx = playerPos.x - ped.x;
          const dy = playerPos.y - ped.y;
          const dist = Math.hypot(dx, dy);
          if (dist < hearRange) {
            threat = { x: playerPos.x, y: playerPos.y, type: 'gunshot' };
            threatDist = dist;
          }
        }
      }
      
      // State machine
      if (threat) {
        if (ped.state !== 'flee' && ped.state !== 'panic') {
          ped.state = threatDist < 40 || threat.type === 'gunshot' || threat.type === 'vehicle_fast' ? 'panic' : 'flee';
          ped.panicTimer = panicTime;
          ped.lastSeenThreat = { x: threat.x, y: threat.y };
          audio.playPedScream(ped);
        } else {
          ped.lastSeenThreat = { x: threat.x, y: threat.y };
          ped.panicTimer = panicTime;
        }
      } else if (ped.state === 'flee' || ped.state === 'panic') {
        ped.panicTimer -= dt;
        if (ped.panicTimer <= 0) {
          ped.state = 'walk';
          ped.currentNode = findNearestNode(ped.x, ped.y);
        }
      } else {
        // Normal walking
        ped.wanderTimer -= dt;
        if (ped.wanderTimer <= 0) {
          ped.wanderTimer = 3 + Math.random() * 7;
          if (Math.random() < 0.3) {
            ped.state = 'idle';
            ped.wanderTimer = 2 + Math.random() * 3;
          } else {
            pickNewTarget(ped);
          }
        }
      }
      
      // Movement
      let moveSpeed = walkSpeed;
      if (ped.state === 'flee') moveSpeed = runSpeed;
      else if (ped.state === 'panic') moveSpeed = fleeSpeed;
      else if (ped.state === 'idle') moveSpeed = 0;
      
      if (moveSpeed > 0) {
        let targetX = ped.targetX;
        let targetY = ped.targetY;
        
        if (ped.state === 'flee' || ped.state === 'panic') {
          // Flee away from threat
          if (ped.lastSeenThreat) {
            const dx = ped.x - ped.lastSeenThreat.x;
            const dy = ped.y - ped.lastSeenThreat.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
              targetX = ped.x + dx / dist * 100;
              targetY = ped.y + dy / dist * 100;
              // Clamp to sidewalk
              const sw = findNearestSidewalk(targetX, targetY, 80);
              if (sw) { targetX = sw.x; targetY = sw.y; }
            }
          }
        }
        
        const dx = targetX - ped.x;
        const dy = targetY - ped.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 5) {
          // Reached target
          if (ped.state === 'walk' || ped.state === 'idle') {
            pickNewTarget(ped);
          } else {
            // Fleeing - pick new flee target
            ped.wanderTimer = 0.5;
          }
        } else {
          // Move towards target
          ped.angle = Math.atan2(dy, dx);
          const moveX = Math.cos(ped.angle) * moveSpeed * dt;
          const moveY = Math.sin(ped.angle) * moveSpeed * dt;
          
          // Simple collision with buildings
          const newX = ped.x + moveX;
          const newY = ped.y + moveY;
          
          let blocked = false;
          for (const b of city.buildings) {
            if (newX + radius > b.x && newX - radius < b.x + b.w &&
                newY + radius > b.y && newY - radius < b.y + b.h) {
              blocked = true;
              break;
            }
          }
          
          if (!blocked && isSidewalk(newX, newY)) {
            ped.x = newX;
            ped.y = newY;
          } else {
            // Try to find alternative path
            pickNewTarget(ped);
          }
        }
      }
      
      // Check if run over by vehicle
      for (const veh of vehicles) {
        if (veh.isParked) continue;
        const dx = veh.x - ped.x;
        const dy = veh.y - ped.y;
        const dist = Math.hypot(dx, dy);
        const vehRadius = (veh.typeData.w + veh.typeData.l) / 4;
        if (dist < vehRadius + radius && Math.abs(veh.speed) > 20) {
          ped.health -= Math.abs(veh.speed) * 0.5;
          if (ped.health <= 0) {
            ped.isDead = true;
            ped.panicTimer = 5.0; // Body stays for 5 seconds
            audio.playPedDeath();
            // Crime reported
            if (player) police.reportCrime('hitPedestrian');
          } else {
            ped.state = 'panic';
            ped.panicTimer = panicTime;
            ped.lastSeenThreat = { x: veh.x, y: veh.y };
          }
          break;
        }
      }
    }
    
    // Spawn new peds if too few
    const activePeds = peds.filter(p => !p.isDead).length;
    const targetPeds = Math.floor(worldWidth * worldHeight / blockSize / blockSize * density * 100);
    if (activePeds < targetPeds && Math.random() < 0.02) {
      if (playerPos) {
        // Spawn away from player
        const angle = Math.random() * Math.PI * 2;
        const dist = 400 + Math.random() * 400;
        const x = playerPos.x + Math.cos(angle) * dist;
        const y = playerPos.y + Math.sin(angle) * dist;
        if (x > 0 && x < worldWidth && y > 0 && y < worldHeight) {
          createPed(x, y);
        }
      }
    }
  }
  
  function findNearestNode(x, y) {
    let best = null, bestDist = Infinity;
    for (const node of sidewalkNodes) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }
  
  function getPedsInRange(x, y, range) {
    const result = [];
    const rangeSq = range * range;
    for (const ped of peds) {
      if (ped.isDead) continue;
      const dx = ped.x - x;
      const dy = ped.y - y;
      if (dx * dx + dy * dy < rangeSq) {
        result.push(ped);
      }
    }
    return result;
  }
  
  function applyExplosion(x, y, radius, damage) {
    for (const ped of peds) {
      if (ped.isDead) continue;
      const dx = ped.x - x;
      const dy = ped.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        ped.health -= damage * (1 - dist / radius);
        if (ped.health <= 0) {
          ped.isDead = true;
          ped.panicTimer = 5.0;
          audio.playPedDeath();
        } else {
          ped.state = 'panic';
          ped.panicTimer = panicTime;
          ped.lastSeenThreat = { x, y };
        }
      }
    }
  }
  
  initPeds();
  
  return {
    peds,
    createPed,
    update,
    getPedsInRange,
    applyExplosion,
    findNearestSidewalk
  };
}
