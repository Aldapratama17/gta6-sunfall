// Sunfall City - HUD system
// Minimap, health/armor bars, money, wanted stars, weapon indicator, mission objective

import { HUD, WORLD, PLAYER } from './config.js';

export function createHUD(canvas, city, player, police, missionsRef) {
  // missionsRef is a live holder: main.js fills it once missions exist
  const missions = { getMissionMarker() { return missionsRef.current ? missionsRef.current.getMissionMarker() : null; } };
  const { minimapSize, minimapZoom, healthBarWidth, healthBarHeight, 
          armorBarHeight, starSize, fontSize, fontFamily } = HUD;
  const { viewWidth, viewHeight } = WORLD;
  
  let money = 0;
  let currentObjective = '';
  let objectiveTimer = 0;
  let missionStartText = '';
  let missionStartTimer = 0;
  let missionCompleteText = '';
  let missionCompleteTimer = 0;
  
  let dialogueActive = false;
  let dialogueText = '';
  let dialogueCharacter = '';
  
  // Minimap canvas (offscreen)
  const minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = minimapSize;
  minimapCanvas.height = minimapSize;
  const mmCtx = minimapCanvas.getContext('2d');
  
  function addMoney(amount) {
    money += amount;
    if (money < 0) money = 0;
  }
  
  function setObjective(text) {
    currentObjective = text;
    objectiveTimer = 5.0;
  }
  
  function showMissionStart(title) {
    missionStartText = `MISSION: ${title}`;
    missionStartTimer = 4.0;
  }
  
  function showMissionComplete(title, reward) {
    missionCompleteText = `${title} COMPLETE - $${reward}`;
    missionCompleteTimer = 5.0;
  }
  
  function showDialogue(text, character) {
    dialogueActive = true;
    dialogueText = text;
    dialogueCharacter = character;
  }
  
  function hideDialogue() {
    dialogueActive = false;
    dialogueText = '';
    dialogueCharacter = '';
  }
  
  function drawMinimap(ctx, camX, camY) {
    const { worldWidth, worldHeight, blockSize, gridWidth, gridHeight } = city;
    const { buildings, waterBodies, parks, hRoads, vRoads, districtMap } = city;
    
    const scale = minimapZoom;
    const cx = minimapSize / 2;
    const cy = minimapSize / 2;
    
    // Clear
    mmCtx.fillStyle = '#0a0a12';
    mmCtx.fillRect(0, 0, minimapSize, minimapSize);
    
    // World bounds
    mmCtx.save();
    mmCtx.translate(cx, cy);
    mmCtx.scale(scale, scale);
    mmCtx.translate(-camX, -camY);
    
    // Districts background
    for (let by = 0; by < gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        const d = districtMap[by * gridWidth + bx];
        const distNames = ['downtown', 'beach', 'suburbs', 'industrial', 'park', 'water'];
        const dist = distNames[d] || 'downtown';
        const colors = {
          downtown: '#1a1a2a', beach: '#102a3a', suburbs: '#1a2a1a',
          industrial: '#2a1a1a', park: '#102a10', water: '#081a2a'
        };
        mmCtx.fillStyle = colors[dist] || '#1a1a2a';
        mmCtx.fillRect(bx * blockSize, by * blockSize, blockSize, blockSize);
      }
    }
    
    // Water
    mmCtx.fillStyle = '#081a3a';
    for (const w of waterBodies) {
      mmCtx.fillRect(w.x, w.y, w.w, w.h);
    }
    
    // Parks
    mmCtx.fillStyle = '#1a4a1a';
    for (const p of parks) {
      mmCtx.fillRect(p.x, p.y, p.w, p.h);
    }
    
    // Roads
    mmCtx.strokeStyle = '#3a3a4a';
    mmCtx.lineWidth = blockSize * 0.6;
    
    for (let by = 0; by <= gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        if (hRoads[by * gridWidth + bx] > 0) {
          mmCtx.beginPath();
          mmCtx.moveTo(bx * blockSize, by * blockSize);
          mmCtx.lineTo((bx + 1) * blockSize, by * blockSize);
          mmCtx.stroke();
        }
      }
    }
    for (let bx = 0; bx <= gridWidth; bx++) {
      for (let by = 0; by < gridHeight; by++) {
        if (vRoads[bx * gridHeight + by] > 0) {
          mmCtx.beginPath();
          mmCtx.moveTo(bx * blockSize, by * blockSize);
          mmCtx.lineTo(bx * blockSize, (by + 1) * blockSize);
          mmCtx.stroke();
        }
      }
    }
    
    // Lane markings on minimap
    mmCtx.strokeStyle = '#4a4a5a';
    mmCtx.lineWidth = 1;
    for (let by = 0; by <= gridHeight; by++) {
      for (let bx = 0; bx < gridWidth; bx++) {
        if (hRoads[by * gridWidth + bx] > 1) { // Avenue or highway
          mmCtx.beginPath();
          mmCtx.moveTo(bx * blockSize + blockSize/2, by * blockSize);
          mmCtx.lineTo((bx + 1) * blockSize - blockSize/2, by * blockSize);
          mmCtx.stroke();
        }
      }
    }
    
    // Buildings (small dots)
    mmCtx.fillStyle = '#3a3a4a';
    for (const b of buildings) {
      mmCtx.fillRect(b.x + 4, b.y + 4, Math.max(2, b.w - 8), Math.max(2, b.h - 8));
    }
    
    // Police blips
    for (const pol of police.activePolice) {
      if (pol.veh) {
        mmCtx.fillStyle = '#1a5aff';
        mmCtx.beginPath();
        mmCtx.arc(pol.veh.x, pol.veh.y, 4 / scale, 0, Math.PI * 2);
        mmCtx.fill();
      }
    }
    
    // Roadblocks
    for (const rb of police.roadblocks) {
      if (rb.veh) {
        mmCtx.fillStyle = '#ff4444';
        mmCtx.fillRect(rb.veh.x - 6/scale, rb.veh.y - 6/scale, 12/scale, 12/scale);
      }
    }
    
    // Mission waypoint
    const marker = missions.getMissionMarker();
    if (marker) {
      mmCtx.strokeStyle = '#4fc3f7';
      mmCtx.lineWidth = 2 / scale;
      mmCtx.beginPath();
      mmCtx.arc(marker.x, marker.y, marker.radius / scale, 0, Math.PI * 2);
      mmCtx.stroke();
      
      // Pulse
      mmCtx.strokeStyle = `rgba(79, 195, 247, ${0.5 + 0.3 * Math.sin(marker.pulse)})`;
      mmCtx.lineWidth = 3 / scale;
      mmCtx.beginPath();
      mmCtx.arc(marker.x, marker.y, (marker.radius + 10 * Math.sin(marker.pulse)) / scale, 0, Math.PI * 2);
      mmCtx.stroke();
    }
    
    // Player
    mmCtx.fillStyle = '#4fc3f7';
    mmCtx.beginPath();
    mmCtx.arc(player.x, player.y, 5 / scale, 0, Math.PI * 2);
    mmCtx.fill();
    
    // Player direction
    mmCtx.strokeStyle = '#4fc3f7';
    mmCtx.lineWidth = 2 / scale;
    mmCtx.beginPath();
    mmCtx.moveTo(player.x, player.y);
    mmCtx.lineTo(player.x + Math.cos(player.angle) * 15 / scale, player.y + Math.sin(player.angle) * 15 / scale);
    mmCtx.stroke();
    
    // Camera view rectangle
    mmCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    mmCtx.lineWidth = 1 / scale;
    const hw = viewWidth / 2 / scale;
    const hh = viewHeight / 2 / scale;
    mmCtx.strokeRect(camX - hw, camY - hh, hw * 2, hh * 2);
    
    mmCtx.restore();
    
    // Draw minimap to main canvas
    ctx.drawImage(minimapCanvas, viewWidth - minimapSize - 10, 10);
    
    // Minimap border
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewWidth - minimapSize - 10, 10, minimapSize, minimapSize);
  }
  
  function drawHealthArmor(ctx) {
    const x = 10, y = 10;
    const w = healthBarWidth;
    const h = healthBarHeight;
    
    // Background
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, w, h);
    
    // Health
    const healthPct = player.health / PLAYER.maxHealth;
    const healthGrad = ctx.createLinearGradient(x, y, x + w, y);
    healthGrad.addColorStop(0, '#c82020');
    healthGrad.addColorStop(1, '#ff6060');
    ctx.fillStyle = healthGrad;
    ctx.fillRect(x, y, w * healthPct, h);
    
    // Armor overlay
    if (player.armor > 0) {
      const armorPct = player.armor / PLAYER.maxArmor;
      const armorGrad = ctx.createLinearGradient(x, y, x + w, y);
      armorGrad.addColorStop(0, '#1a5aff');
      armorGrad.addColorStop(1, '#4080ff');
      ctx.fillStyle = armorGrad;
      ctx.fillRect(x, y + h - armorBarHeight, w * armorPct, armorBarHeight);
    }
    
    // Border
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    // Labels
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#eef1f5';
    ctx.fillText('HP', x + 4, y + h - 3);
    if (player.armor > 0) {
      ctx.fillStyle = '#8ab4ff';
      ctx.fillText('ARMOR', x + 4, y + h - armorBarHeight - 2);
    }
  }
  
  function drawMoney(ctx) {
    const x = 10, y = healthBarHeight + 18;
    ctx.font = `bold ${fontSize + 2}px ${fontFamily}`;
    ctx.fillStyle = '#f2c94c';
    ctx.fillText(`$${money.toLocaleString()}`, x, y);
  }
  
  function drawWantedStars(ctx) {
    const x = 10, y = healthBarHeight + 44;
    const stars = police.wantedStars;
    
    for (let i = 0; i < 5; i++) {
      const sx = x + i * (starSize + 2);
      const active = i < stars;
      
      // Star background
      ctx.fillStyle = active ? '#ffcc00' : '#3a3a4a';
      drawStar(ctx, sx + starSize/2, y + starSize/2, starSize/2, active ? 5 : 3);
      
      if (active) {
        // Glow
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 8;
        drawStar(ctx, sx + starSize/2, y + starSize/2, starSize/2, 5);
        ctx.shadowBlur = 0;
      }
    }
  }
  
  function drawStar(ctx, cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.5;
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  function drawWeapon(ctx) {
    const x = viewWidth - 100, y = viewHeight - 50;
    
    if (player.hasGun) {
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = '#eef1f5';
      ctx.textAlign = 'right';
      ctx.fillText(`AMMO: ${player.ammo}`, x, y);
      
      // Gun icon
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(x - 60, y - 20, 50, 16);
      ctx.fillRect(x - 55, y - 28, 12, 10);
    } else {
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = '#8b93a3';
      ctx.textAlign = 'right';
      ctx.fillText('FISTS', x, y);
    }
    ctx.textAlign = 'left';
  }
  
  function drawObjective(ctx) {
    if (!currentObjective || objectiveTimer <= 0) return;
    
    const x = viewWidth / 2, y = 50;
    objectiveTimer -= 1/60;
    
    ctx.font = `bold ${fontSize + 1}px ${fontFamily}`;
    ctx.fillStyle = '#4fc3f7';
    ctx.textAlign = 'center';
    
    // Background
    const metrics = ctx.measureText(currentObjective);
    ctx.fillStyle = 'rgba(26,26,42,0.9)';
    ctx.fillRect(x - metrics.width/2 - 10, y - 20, metrics.width + 20, 28);
    
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(currentObjective, x, y);
    ctx.textAlign = 'left';
  }
  
  function drawMissionStart(ctx) {
    if (missionStartTimer <= 0) return;
    missionStartTimer -= 1/60;
    
    const x = viewWidth / 2, y = viewHeight / 2 - 100;
    const alpha = Math.min(1, missionStartTimer);
    
    ctx.font = `bold ${fontSize + 6}px ${fontFamily}`;
    ctx.fillStyle = `rgba(242, 201, 76, ${alpha})`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 3;
    ctx.strokeText(missionStartText, x, y);
    ctx.fillText(missionStartText, x, y);
    ctx.textAlign = 'left';
  }
  
  function drawMissionComplete(ctx) {
    if (missionCompleteTimer <= 0) return;
    missionCompleteTimer -= 1/60;
    
    const x = viewWidth / 2, y = viewHeight / 2;
    const alpha = Math.min(1, missionCompleteTimer);
    
    ctx.font = `bold ${fontSize + 8}px ${fontFamily}`;
    ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 4;
    ctx.strokeText(missionCompleteText, x, y);
    ctx.fillText(missionCompleteText, x, y);
    ctx.textAlign = 'left';
  }
  
  function drawDialogue(ctx) {
    if (!dialogueActive) return;
    
    const boxW = viewWidth - 40;
    const boxH = 100;
    const x = 20, y = viewHeight - boxH - 20;
    
    // Box
    ctx.fillStyle = 'rgba(26,26,42,0.95)';
    ctx.fillRect(x, y, boxW, boxH);
    
    // Character name
    ctx.font = `bold ${fontSize + 2}px ${fontFamily}`;
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(dialogueCharacter, x + 16, y + 24);
    
    // Dialogue text
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#eef1f5';
    ctx.fillText(dialogueText, x + 16, y + 50);
    
    // Continue prompt
    const promptAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 300);
    ctx.fillStyle = `rgba(139,147,163,${promptAlpha})`;
    ctx.font = `${fontSize - 1}px ${fontFamily}`;
    ctx.fillText('Press SPACE to continue...', x + boxW - 200, y + boxH - 16);
  }
  
  function drawWasted(ctx) {
    if (!player.wasted) return;
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    ctx.font = `bold 48px ${fontFamily}`;
    ctx.fillStyle = '#c82020';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', viewWidth/2, viewHeight/2 - 20);
    
    ctx.font = `${fontSize + 2}px ${fontFamily}`;
    ctx.fillStyle = '#eef1f5';
    ctx.fillText('Respawning...', viewWidth/2, viewHeight/2 + 30);
    ctx.textAlign = 'left';
  }
  
  function drawBusted(ctx, combat) {
    if (!combat.getBusted()) return;
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    ctx.font = `bold 48px ${fontFamily}`;
    ctx.fillStyle = '#1a5aff';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', viewWidth/2, viewHeight/2 - 20);
    
    ctx.font = `${fontSize + 2}px ${fontFamily}`;
    ctx.fillStyle = '#eef1f5';
    ctx.fillText('Lost weapons and $' + Math.floor(money * 0.1), viewWidth/2, viewHeight/2 + 30);
    ctx.textAlign = 'left';
  }
  
  function draw(ctx, camX, camY, combat) {
    drawMinimap(ctx, camX, camY);
    drawHealthArmor(ctx);
    drawMoney(ctx);
    drawWantedStars(ctx);
    drawWeapon(ctx);
    drawObjective(ctx);
    drawMissionStart(ctx);
    drawMissionComplete(ctx);
    drawDialogue(ctx);
    drawWasted(ctx);
    drawBusted(ctx, combat);
  }
  
  return {
    addMoney,
    setObjective,
    showMissionStart,
    showMissionComplete,
    showDialogue,
    hideDialogue,
    draw,
    get money() { return money; },
    set money(v) { money = v; }
  };
}
