// Sunfall City - Main game loop and state machine
// Initializes all systems, runs the game loop

import { WORLD, STEP, TIME, PED } from './config.js';
import { initCity, cityRandomSeed } from './city.js';
import { createPlayer } from './player.js';
import { createVehicleSystem } from './vehicles.js';
import { createPedSystem } from './peds.js';
import { createPoliceSystem } from './police.js';
import { createMissionSystem } from './missions.js';
import { createCombatSystem } from './combat.js';
import { createHUD } from './hud.js';
import { createAudioSystem } from './audio.js';
import { createUI } from './ui.js';
import { createParticleSystem } from './particles.js';

const { viewWidth, viewHeight } = WORLD;

let canvas = null;
let ctx = null;
let gameState = 'loading';
let lastTime = 0;
let accumulator = 0;
let running = false;

// Game systems
let city = null;
let player = null;
let vehicles = null;
let peds = null;
let police = null;
let missions = null;
let combat = null;
let hud = null;
let audio = null;
let ui = null;
let particles = null;

// Debug
let showDebug = false;
let frameCount = 0;
let fps = 0;
let lastFpsTime = 0;

export function initGame(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = viewWidth;
  canvas.height = viewHeight;
  
  // Initialize systems in order
  cityRandomSeed(12345); // Deterministic city
  city = initCity(12345);
  
  audio = createAudioSystem();
  audio.init();
  
  particles = createParticleSystem();
  
  player = createPlayer(city, null, audio); // vehicles set after
  vehicles = createVehicleSystem(city, audio);
  // Link player to vehicles
  player.vehicles = vehicles;
  
  police = createPoliceSystem(city, vehicles, audio);
  peds = createPedSystem(city, audio, police);
  combat = createCombatSystem(city, player, peds, vehicles, police, audio, particles);
  const missionsHolder = { current: null };
  hud = createHUD(canvas, city, player, police, missionsHolder);
  missions = createMissionSystem(city, player, police, vehicles, audio, hud);
  missionsHolder.current = missions;
  ui = createUI(canvas, null, player, missions, hud, audio, city);
  
  // Cross-link systems
  player.combat = combat;
  player.missions = missions;
  player.police = police;
  player.hud = hud;
  player.city = city;
  player.particles = particles;
  vehicles.player = player;
  police.setPlayer(player);
  combat.player = player;
  missions.player = player;
  ui.game = {
    reset: resetGame,
    police,
    vehicles,
    peds,
    combat,
    missions,
    hud,
    audio,
    player,
    city,
    particles
  };
  
  // Set canvas on player for mouse aiming
  player.setCanvas(canvas);
  player.setupInput();
  
  // Setup UI input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') showDebug = !showDebug;
    if (e.code === 'F2') {
      // Quick save
      ui.saveGame(0);
      hud.setObjective('Quick saved!');
    }
    if (e.code === 'F3') {
      // Quick load
      ui.loadGame(0);
      hud.setObjective('Quick loaded!');
    }
  });
  
  gameState = 'menu';
  running = true;
  
  // Start game loop
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  // Reset all systems
  cityRandomSeed(12345);
  city = initCity(12345);
  
  // Recreate systems with new city
  particles.clear();
  
  player.x = 3072;
  player.y = 3072;
  player.angle = 0;
  player.health = 100;
  player.armor = 0;
  player.ammo = 0;
  player.hasGun = false;
  player.wasted = false;
  player.inVehicle = false;
  player.currentVehicle = null;
  player.sprintStamina = 100;
  
  // Clear vehicles
  vehicles.vehicles.length = 0;
  vehicles.trafficVehicles.length = 0;
  vehicles.parkedVehicles.length = 0;
  vehicles.policeVehicles.length = 0;
  vehicles.trafficLanes.clear();
  
  // Re-init parked cars and traffic lanes
  // (Need to re-run init functions - recreate vehicle system)
  
  peds.peds.length = 0;
  peds.sidewalkNodes.length = 0;
  
  police.activePolice.length = 0;
  police.roadblocks.length = 0;
  police.helicopter = null;
  police.wantedLevel = 0;
  police.wantedStars = 0;
  
  combat.bullets.length = 0;
  combat.pickups.length = 0;
  combat.muzzleFlashes.length = 0;
  combat.busted = false;
  
  missions.initMissions();
  hud.money = 0;
  
  // Re-initialize
  peds.initPeds();
  vehicles.initParkedCars();
  vehicles.initTrafficLanes();
  combat.initPickups();
}

function gameLoop(timestamp) {
  if (!running) return;
  
  const dt = Math.min((timestamp - lastTime) / 1000, 0.25); // Cap at 250ms
  lastTime = timestamp;
  
  // Fixed timestep
  accumulator += dt;
  while (accumulator >= STEP) {
    fixedUpdate(STEP);
    accumulator -= STEP;
  }
  
  // Render
  render(dt);
  
  // FPS counter
  frameCount++;
  if (timestamp - lastFpsTime > 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = timestamp;
  }
  
  requestAnimationFrame(gameLoop);
}

function fixedUpdate(dt) {
  const state = ui.getState();
  
  if (state === 'playing') {
    // Update systems
    peds.update(dt, player, vehicles.vehicles, city);
    vehicles.update(dt, player);
    police.update(dt);
    combat.update(dt);
    missions.update(dt);
    
    particles.update(dt);
    player.update(dt, peds, vehicles.trafficVehicles);
  }
}

function render(dt) {
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  
  const state = ui.getState();
  if (state !== 'playing') return;
  
  const cam = player.getCamera();
  const hw = viewWidth / 2;
  const hh = viewHeight / 2;
  
  // Transform to camera space
  ctx.save();
  ctx.translate(hw - cam.x, hh - cam.y);
  
  // Render world
  renderWorld(ctx);
  
  // Render vehicles
  renderVehicles(ctx);
  
  // Render peds
  renderPeds(ctx);
  
  // Render bullets
  renderBullets(ctx);
  
  // Render pickups
  renderPickups(ctx);
  
  // Render muzzle flashes
  renderMuzzleFlashes(ctx);
  
  // Render particles
  particles.draw(ctx);
  
  ctx.restore();
  
  // Render HUD (screen space)
  hud.draw(ctx, cam.x, cam.y, combat);
  
  // Render UI
  ui.draw(ctx);
  
  // Debug
  if (showDebug) renderDebug(ctx);
}

function renderWorld(ctx) {
  const { worldWidth, worldHeight, blockSize, gridWidth, gridHeight, buildings, parks, waterBodies, districtMap, hRoads, vRoads, getGroundColor } = city;
  
  // Draw ground (districts)
  // We draw visible area only
  const cam = player.getCamera();
  const hw = viewWidth / 2;
  const hh = viewHeight / 2;
  const minBX = Math.max(0, Math.floor((cam.x - hw) / blockSize));
  const maxBX = Math.min(gridWidth - 1, Math.floor((cam.x + hw) / blockSize));
  const minBY = Math.max(0, Math.floor((cam.y - hh) / blockSize));
  const maxBY = Math.min(gridHeight - 1, Math.floor((cam.y + hh) / blockSize));
  
  for (let by = minBY; by <= maxBY; by++) {
    for (let bx = minBX; bx <= maxBX; bx++) {
      const x = bx * blockSize;
      const y = by * blockSize;
      const color = getGroundColor(x + blockSize / 2, y + blockSize / 2);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, blockSize, blockSize);
    }
  }
  
  // Draw water
  for (const w of waterBodies) {
    if (w.x + w.w < cam.x - hw || w.x > cam.x + hw || w.y + w.h < cam.y - hh || w.y > cam.y + hh) continue;
    ctx.fillStyle = w.deep ? '#081a3a' : '#1a4a6a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // Waves
    ctx.strokeStyle = w.deep ? 'rgba(30,60,100,0.5)' : 'rgba(60,120,180,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w.w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(w.x + i, w.y);
      ctx.lineTo(w.x + i, w.y + w.h);
      ctx.stroke();
    }
  }
  
  // Draw parks
  for (const p of parks) {
    if (p.x + p.w < cam.x - hw || p.x > cam.x + hw || p.y + p.h < cam.y - hh || p.y > cam.y + hh) continue;
    const dist = DISTRICTS.park;
    if (p.type === 0) { // grass
      ctx.fillStyle = dist.grassColor || '#2a5a2a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    } else if (p.type === 1) { // trees
      ctx.fillStyle = dist.grassColor || '#2a5a2a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Trees
      ctx.fillStyle = dist.treeColor || '#1a4a1a';
      for (let tx = p.x + 16; tx < p.x + p.w - 16; tx += 48) {
        for (let ty = p.y + 16; ty < p.y + p.h - 16; ty += 48) {
          ctx.beginPath();
          ctx.arc(tx, ty, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else { // mixed
      ctx.fillStyle = dist.grassColor || '#2a5a2a';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = dist.treeColor || '#1a4a1a';
      for (let tx = p.x + 24; tx < p.x + p.w - 24; tx += 64) {
        for (let ty = p.y + 24; ty < p.y + p.h - 24; ty += 64) {
          ctx.beginPath();
          ctx.arc(tx, ty, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  
  // Draw roads
  ctx.lineWidth = 2;
  
  // Horizontal roads
  for (let by = minBY; by <= maxBY + 1; by++) {
    for (let bx = minBX; bx <= maxBX; bx++) {
      const type = hRoads[by * gridWidth + bx];
      if (type === 0) continue;
      const y = by * blockSize;
      const x = bx * blockSize;
      if (type === 3) { // highway
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + blockSize, y);
        ctx.stroke();
        // Lines
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + blockSize, y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (type === 2) { // avenue
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + blockSize, y);
        ctx.stroke();
        // Center line
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + blockSize, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Sidewalk edges
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + blockSize, y - 8);
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + blockSize, y + 8);
        ctx.stroke();
      } else { // street
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + blockSize, y);
        ctx.stroke();
      }
    }
  }
  
  // Vertical roads
  for (let bx = minBX; bx <= maxBX + 1; bx++) {
    for (let by = minBY; by <= maxBY; by++) {
      const type = vRoads[bx * gridHeight + by];
      if (type === 0) continue;
      const x = bx * blockSize;
      const y = by * blockSize;
      if (type === 3) { // highway
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + blockSize);
        ctx.stroke();
        // Lines
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 20]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + blockSize);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (type === 2) { // avenue
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + blockSize);
        ctx.stroke();
        // Center line
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + blockSize);
        ctx.stroke();
        ctx.setLineDash([]);
        // Sidewalk edges
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x - 8, y + blockSize);
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 8, y + blockSize);
        ctx.stroke();
      } else { // street
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + blockSize);
        ctx.stroke();
      }
    }
  }
  
  // Draw buildings
  for (const b of buildings) {
    if (b.x + b.w < cam.x - hw || b.x > cam.x + hw || b.y + b.h < cam.y - hh || b.y > cam.y + hh) continue;
    
    // Building base
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    
    // Windows
    ctx.fillStyle = b.windowColor;
    for (const win of b.windows) {
      ctx.fillRect(win.x, win.y, win.w, win.h);
    }
    
    // Roof detail
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function renderVehicles(ctx) {
  const allVehicles = [...vehicles.vehicles, ...vehicles.trafficVehicles, ...vehicles.parkedVehicles, ...vehicles.policeVehicles];
  
  for (const veh of allVehicles) {
    ctx.save();
    ctx.translate(veh.x, veh.y);
    ctx.rotate(veh.angle);
    
    const w = veh.typeData.w;
    const l = veh.typeData.l;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, l * 0.1, w * 0.6, l * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    let color = veh.typeData.color;
    if (veh.damage > 500) color = darkenColor(color, 0.5);
    ctx.fillStyle = color;
    roundRect(ctx, -w/2, -l/2, w, l, 4);
    ctx.fill();
    
    // Windows
    ctx.fillStyle = '#2a4a6a';
    roundRect(ctx, -w/2 + 3, -l/2 + 4, w - 6, l * 0.5, 2);
    ctx.fill();
    
    // Damage
    if (veh.damage > 0) {
      ctx.strokeStyle = '#8a2a2a';
      ctx.lineWidth = 2;
      roundRect(ctx, -w/2, -l/2, w, l, 4);
      ctx.stroke();
    }
    
    // Wheels
    ctx.fillStyle = '#1a1a1a';
    const wx = w/2 - 3;
    const wy = l/2 - 8;
    ctx.fillRect(-wx, -wy, 6, 8);
    ctx.fillRect(wx - 6, -wy, 6, 8);
    ctx.fillRect(-wx, wy, 6, 8);
    ctx.fillRect(wx - 6, wy, 6, 8);
    
    // Headlights (front)
    if (veh.speed > 0.1) {
      ctx.fillStyle = '#fffae0';
      ctx.beginPath();
      ctx.arc(-w/2 + 4, -l/2 + 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w/2 - 4, -l/2 + 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Taillights (rear)
    ctx.fillStyle = '#ff2222';
    ctx.beginPath();
    ctx.arc(-w/2 + 4, l/2 - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w/2 - 4, l/2 - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Police lights
    if (veh.isPolice) {
      const t = Date.now() / 200;
      ctx.fillStyle = Math.sin(t) > 0 ? '#ff0000' : '#0000ff';
      ctx.beginPath();
      ctx.arc(0, -l/2 - 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = Math.sin(t) > 0 ? '#0000ff' : '#ff0000';
      ctx.beginPath();
      ctx.arc(0, -l/2 - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

function renderPeds(ctx) {
  for (const ped of peds.peds) {
    if (ped.isDead) continue;
    
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, PED.radius * 0.4, PED.radius * 0.8, PED.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = ped.type.color;
    ctx.beginPath();
    ctx.arc(0, 0, PED.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    const headColor = darkenColor(ped.type.color, 0.8);
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(0, -PED.radius * 0.3, PED.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    // Direction indicator
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * PED.radius * 0.4, Math.sin(ped.angle) * PED.radius * 0.4, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Panic indicator
    if (ped.state === 'panic' || ped.state === 'flee') {
      ctx.fillStyle = '#ff4444';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -PED.radius * 2);
    }
    
    ctx.restore();
  }
}

function renderBullets(ctx) {
  for (const b of combat.getBullets()) {
    ctx.fillStyle = b.type === 'police_bullet' ? '#ff4444' : '#ffcc00';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Trail
    ctx.strokeStyle = b.type === 'police_bullet' ? 'rgba(255,68,68,0.5)' : 'rgba(255,204,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(b.angle) * 15, b.y - Math.sin(b.angle) * 15);
    ctx.stroke();
  }
}

function renderPickups(ctx) {
  for (const p of combat.getPickups()) {
    if (p.collected) continue;
    
    const bob = Math.sin(p.bobOffset) * 4;
    const colors = {
      gun: '#ffaa00',
      health: '#4caf50',
      armor: '#2196f3'
    };
    const color = colors[p.type] || '#ffffff';
    
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.angle);
    
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    ctx.fillStyle = color;
    if (p.type === 'gun') {
      // Gun shape
      ctx.fillRect(-8, -3, 16, 6);
      ctx.fillRect(-4, -8, 8, 6);
    } else if (p.type === 'health') {
      // Cross
      ctx.fillRect(-2, -10, 4, 20);
      ctx.fillRect(-10, -2, 20, 4);
    } else {
      // Shield
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, -4);
      ctx.lineTo(10, 8);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-10, -4);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function renderMuzzleFlashes(ctx) {
  for (const f of combat.getMuzzleFlashes()) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);
    
    const alpha = 1 - f.timer / 0.06;
    ctx.fillStyle = `rgba(255,248,192,${alpha})`;
    
    // Flash
    ctx.fillRect(-1, -15, 2, 30);
    ctx.fillRect(-15, -1, 30, 2);
    
    ctx.restore();
  }
}

function renderDebug(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(10, 10, 280, 200);
  
  ctx.font = '12px monospace';
  ctx.fillStyle = '#4fc3f7';
  let y = 30;
  const lines = [
    `FPS: ${fps}`,
    `State: ${ui.getState()}`,
    `Player: ${player.x.toFixed(0)}, ${player.y.toFixed(0)}`,
    `Health: ${player.health}/${100}`,
    `Armor: ${player.armor}`,
    `Ammo: ${player.ammo}`,
    `Wanted: ${police.wantedLevel}★`,
    `Money: $${hud.money}`,
    `Vehicles: ${vehicles.vehicles.length}`,
    `Traffic: ${vehicles.trafficVehicles.length}`,
    `Peds: ${peds.peds.length}`,
    `Police: ${police.activePolice.length}`,
    `Bullets: ${combat.getBullets().length}`,
    `Particles: ${particles.particles ? particles.particles.length : 0}`,
    `Time: ${(city.timeOfDay * 24).toFixed(1)}:00`,
    `Mission: ${missions.currentMission ? missions.currentMission.id : 'none'}`
  ];
  
  for (const line of lines) {
    ctx.fillText(line, 20, y);
    y += 16;
  }
  
  ctx.restore();
}

function lerpColor(a, b, t) {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ar = (ca >> 16) & 255;
  const ag = (ca >> 8) & 255;
  const ab = ca & 255;
  const br = (cb >> 16) & 255;
  const bg = (cb >> 8) & 255;
  const bb = cb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function darkenColor(color, factor) {
  const c = parseInt(color.slice(1), 16);
  const r = Math.round(((c >> 16) & 255) * factor);
  const g = Math.round(((c >> 8) & 255) * factor);
  const b = Math.round((c & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h - r);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


// Bootstrap: call initGame when DOM is ready
if (typeof document !== 'undefined') {
  const canvasEl = document.getElementById('game');
  if (canvasEl) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initGame(canvasEl));
    } else {
      initGame(canvasEl);
    }
  }
}

// Export for debugging
window.SunfallCity = {
  get city() { return city; },
  get player() { return player; },
  get vehicles() { return vehicles; },
  get peds() { return peds; },
  get police() { return police; },
  get missions() { return missions; },
  get combat() { return combat; },
  get hud() { return hud; },
  get audio() { return audio; },
  get ui() { return ui; },
  get particles() { return particles; }
};
