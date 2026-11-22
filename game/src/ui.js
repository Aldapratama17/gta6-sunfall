// Sunfall City - UI system
// Start screen, pause menu, save/load, settings, controls help

import { SAVE_KEY, WORLD, PLAYER, VEHICLE, HUD } from './config.js';

export function createUI(canvas, game, player, missions, hud, audio, city) {
  const { viewWidth, viewHeight } = WORLD;
  
  let gameState = 'menu'; // 'menu', 'playing', 'paused', 'dead'
  let menuSelection = 0;
  let pauseSelection = 0;
  let settingsSelection = 0;
  let inSettings = false;
  let showControls = false;
  let saveSlots = [];
  
  const menuOptions = ['New Game', 'Load Game', 'Controls', 'Settings', 'Quit'];
  const pauseOptions = ['Resume', 'Save Game', 'Load Game', 'Settings', 'Main Menu', 'Quit'];
  const settingsOptions = ['Master Volume', 'SFX Volume', 'Music Volume', 'Back'];
  
  function init() {
    loadSaveSlots();
    setupInput();
  }
  
  function setupInput() {
    window.addEventListener('keydown', (e) => {
      if (gameState === 'menu') {
        handleMenuInput(e);
      } else if (gameState === 'paused') {
        handlePauseInput(e);
      } else if (gameState === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          pauseGame();
        }
      }
    });
  }
  
  function handleMenuInput(e) {
    if (showControls) {
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space' || e.code === 'Enter') {
        showControls = false;
      }
      return;
    }
    
    if (inSettings) {
      handleSettingsInput(e);
      return;
    }
    
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      menuSelection = (menuSelection - 1 + menuOptions.length) % menuOptions.length;
      audio.playPickup();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      menuSelection = (menuSelection + 1) % menuOptions.length;
      audio.playPickup();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      selectMenuOption();
    } else if (e.code === 'Escape') {
      // Quit from main menu
    }
  }
  
  function handleSettingsInput(e) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      settingsSelection = (settingsSelection - 1 + settingsOptions.length) % settingsOptions.length;
      audio.playPickup();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      settingsSelection = (settingsSelection + 1) % settingsOptions.length;
      audio.playPickup();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      adjustSetting(-0.1);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      adjustSetting(0.1);
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
      if (settingsSelection === settingsOptions.length - 1) {
        inSettings = false;
        settingsSelection = 0;
      }
    }
  }
  
  function handlePauseInput(e) {
    if (inSettings) {
      handleSettingsInput(e);
      return;
    }
    
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      pauseSelection = (pauseSelection - 1 + pauseOptions.length) % pauseOptions.length;
      audio.playPickup();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      pauseSelection = (pauseSelection + 1) % pauseOptions.length;
      audio.playPickup();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      selectPauseOption();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      resumeGame();
    }
  }
  
  function selectMenuOption() {
    const opt = menuOptions[menuSelection];
    switch (opt) {
      case 'New Game':
        startNewGame();
        break;
      case 'Load Game':
        showLoadMenu();
        break;
      case 'Controls':
        showControls = true;
        break;
      case 'Settings':
        inSettings = true;
        settingsSelection = 0;
        break;
      case 'Quit':
        // Can't really quit a web page
        break;
    }
  }
  
  function selectPauseOption() {
    const opt = pauseOptions[pauseSelection];
    switch (opt) {
      case 'Resume':
        resumeGame();
        break;
      case 'Save Game':
        showSaveMenu();
        break;
      case 'Load Game':
        showLoadMenu();
        break;
      case 'Settings':
        inSettings = true;
        settingsSelection = 0;
        break;
      case 'Main Menu':
        returnToMenu();
        break;
      case 'Quit':
        break;
    }
  }
  
  function adjustSetting(delta) {
    const opt = settingsOptions[settingsSelection];
    switch (opt) {
      case 'Master Volume':
        audio.setMasterVolume(Math.max(0, Math.min(1, audio.getMasterVolume() + delta)));
        break;
      case 'SFX Volume':
        audio.setSfxVolume(Math.max(0, Math.min(1, audio.getSfxVolume() + delta)));
        break;
      case 'Music Volume':
        audio.setMusicVolume(Math.max(0, Math.min(1, audio.getMusicVolume() + delta)));
        break;
    }
  }
  
  function getMasterVolume() { return audio.getMasterVolume ? audio.getMasterVolume() : 0.5; }
  function getSfxVolume() { return audio.getSfxVolume ? audio.getSfxVolume() : 0.6; }
  function getMusicVolume() { return audio.getMusicVolume ? audio.getMusicVolume() : 0.3; }
  
  // Add getters to audio
  if (!audio.getMasterVolume) {
    audio.getMasterVolume = () => audio.masterVolume || 0.5;
    audio.getSfxVolume = () => audio.sfxVolume || 0.6;
    audio.getMusicVolume = () => audio.musicVolume || 0.3;
    audio.setMasterVolume = (v) => { audio.masterVolume = v; if (audio.masterGain) audio.masterGain.gain.value = v; };
    audio.setSfxVolume = (v) => { audio.sfxVolume = v; if (audio.sfxGain) audio.sfxGain.gain.value = v; };
    audio.setMusicVolume = (v) => { audio.musicVolume = v; if (audio.musicGain) audio.musicGain.gain.value = v; };
  }
  
  function startNewGame() {
    gameState = 'playing';
    if (game && typeof game.reset === 'function') game.reset();
    player.respawn();
    if (missions && typeof missions.initMissions === 'function') missions.initMissions();
    hud.addMoney(0);
    audio.playMissionStart();
  }
  
  function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    pauseSelection = 0;
    inSettings = false;
  }
  
  function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    inSettings = false;
  }
  
  function returnToMenu() {
    gameState = 'menu';
    menuSelection = 0;
    inSettings = false;
    showControls = false;
    // Stop all sounds
    if (audio.stopHeli) audio.stopHeli();
  }
  
  function showSaveMenu() {
    // For simplicity, just save to slot 0
    saveGame(0);
    hud.setObjective('Game saved!');
  }
  
  function showLoadMenu() {
    // Load most recent save
    const saves = loadSaveSlots();
    if (saves.length > 0) {
      loadGame(0);
      resumeGame();
    }
  }
  
  function saveGame(slot) {
    const state = {
      player: {
        x: player.x, y: player.y, angle: player.angle,
        health: player.health, armor: player.armor,
        ammo: player.ammo, hasGun: player.hasGun,
        money: hud.money
      },
      missions: missions.getState(),
      police: { wantedLevel: game.police.wantedLevel },
      time: Date.now(),
      version: 1
    };
    
    const saves = loadSaveSlots();
    saves[slot] = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  }
  
  function loadSaveSlots() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      saveSlots = data ? JSON.parse(data) : [];
    } catch {
      saveSlots = [];
    }
    // Ensure array of 5 slots
    while (saveSlots.length < 5) saveSlots.push(null);
    return saveSlots;
  }
  
  function loadGame(slot) {
    const saves = loadSaveSlots();
    const state = saves[slot];
    if (!state) return false;
    
    // Restore player
    player.x = state.player.x;
    player.y = state.player.y;
    player.angle = state.player.angle;
    player.health = state.player.health;
    player.armor = state.player.armor;
    player.ammo = state.player.ammo;
    player.hasGun = state.player.hasGun;
    hud.money = state.player.money;
    
    // Restore missions
    missions.loadState(state.missions);
    
    // Restore police
    game.police.wantedLevel = state.police.wantedLevel;
    if (game.police.wantedLevel > 0) {
      game.police.addWanted(0); // Trigger spawn
    }
    
    return true;
  }
  
  function drawMenu(ctx) {
    // Background
    const time = Date.now() / 1000;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    // Animated background - city silhouette
    drawCitySilhouette(ctx, time);
    
    // Title
    ctx.font = 'bold 72px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    
    // Glow effect
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('SUNFALL CITY', viewWidth/2, 180);
    ctx.shadowBlur = 0;
    
    // Subtitle
    ctx.font = '20px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b93a3';
    ctx.fillText('An Original Open-World Crime Game', viewWidth/2, 220);
    
    // Menu options
    ctx.font = '28px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    
    const startY = 320;
    const spacing = 56;
    
    menuOptions.forEach((opt, i) => {
      const y = startY + i * spacing;
      const selected = i === menuSelection && !showControls && !inSettings;
      
      if (selected) {
        ctx.fillStyle = '#4fc3f7';
        // Selection indicator
        ctx.fillStyle = 'rgba(79, 195, 247, 0.15)';
        ctx.fillRect(viewWidth/2 - 180, y - 30, 360, 44);
        ctx.fillStyle = '#4fc3f7';
      } else {
        ctx.fillStyle = '#eef1f5';
      }
      
      ctx.fillText(opt, viewWidth/2, y);
    });
    
    // Controls help screen
    if (showControls) {
      drawControlsOverlay(ctx);
    }
    
    // Settings screen
    if (inSettings) {
      drawSettingsOverlay(ctx);
    }
    
    // Version
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4a4a5a';
    ctx.textAlign = 'right';
    ctx.fillText('v1.0.0 | make.fun gta6-01', viewWidth - 20, viewHeight - 20);
    ctx.textAlign = 'left';
  }
  
  function drawControlsOverlay(ctx) {
    // Semi-transparent background
    ctx.fillStyle = 'rgba(10,10,18,0.95)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    ctx.font = 'bold 32px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4fc3f7';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', viewWidth/2, 100);
    
    const controls = [
      ['WASD / Arrows', 'Move / Drive'],
      ['Shift', 'Sprint / Accelerate'],
      ['Space', 'Attack / Shoot / Handbrake'],
      ['E', 'Enter/Exit Vehicle'],
      ['Mouse', 'Aim (on foot)'],
      ['P / Escape', 'Pause'],
      ['Space/Enter', 'Continue Dialogue'],
    ];
    
    ctx.font = '20px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    const startX = viewWidth/2 - 250;
    let y = 160;
    
    controls.forEach(([key, desc]) => {
      ctx.fillStyle = '#4fc3f7';
      ctx.fillText(key, startX, y);
      ctx.fillStyle = '#eef1f5';
      ctx.fillText(desc, startX + 180, y);
      y += 36;
    });
    
    // Prompt
    ctx.font = '16px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b93a3';
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC or SPACE to return', viewWidth/2, viewHeight - 40);
    ctx.textAlign = 'left';
  }
  
  function drawSettingsOverlay(ctx) {
    ctx.fillStyle = 'rgba(10,10,18,0.95)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    ctx.font = 'bold 32px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4fc3f7';
    ctx.textAlign = 'center';
    ctx.fillText('SETTINGS', viewWidth/2, 100);
    
    ctx.font = '22px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    const startX = viewWidth/2 - 200;
    let y = 160;
    
    const volumes = [
      { label: 'Master Volume', get: getMasterVolume },
      { label: 'SFX Volume', get: getSfxVolume },
      { label: 'Music Volume', get: getMusicVolume },
      { label: 'Back', get: () => null }
    ];
    
    volumes.forEach((opt, i) => {
      const selected = i === settingsSelection;
      
      if (selected) {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.15)';
        ctx.fillRect(startX - 20, y - 28, 400, 40);
        ctx.fillStyle = '#4fc3f7';
      } else {
        ctx.fillStyle = '#eef1f5';
      }
      
      ctx.fillText(opt.label, startX, y);
      
      if (opt.get()) {
        const vol = Math.round(opt.get() * 100);
        // Volume bar
        const barW = 200;
        const barX = startX + 220;
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(barX, y - 20, barW, 16);
        ctx.fillStyle = '#4fc3f7';
        ctx.fillRect(barX, y - 20, barW * vol / 100, 16);
        ctx.fillStyle = '#eef1f5';
        ctx.fillText(`${vol}%`, barX + barW + 10, y);
      }
      
      y += 50;
    });
    
    ctx.font = '16px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b93a3';
    ctx.textAlign = 'center';
    ctx.fillText('←/→ to adjust, ESC to go back', viewWidth/2, viewHeight - 40);
    ctx.textAlign = 'left';
  }
  
  function drawPauseMenu(ctx) {
    // Dim game
    ctx.fillStyle = 'rgba(10,10,18,0.85)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    // Title
    ctx.font = 'bold 48px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#f2c94c';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', viewWidth/2, 160);
    
    // Options
    ctx.font = '26px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const startY = 260;
    const spacing = 52;
    
    pauseOptions.forEach((opt, i) => {
      const y = startY + i * spacing;
      const selected = i === pauseSelection && !inSettings;
      
      if (selected) {
        ctx.fillStyle = 'rgba(242, 201, 76, 0.15)';
        ctx.fillRect(viewWidth/2 - 180, y - 30, 360, 44);
        ctx.fillStyle = '#f2c94c';
      } else {
        ctx.fillStyle = '#eef1f5';
      }
      
      ctx.fillText(opt, viewWidth/2, y);
    });
    
    if (inSettings) {
      drawSettingsOverlay(ctx);
    }
    
    ctx.textAlign = 'left';
  }
  
  function drawCitySilhouette(ctx, time) {
    // Draw a stylized city skyline in background
    ctx.save();
    ctx.translate(0, viewHeight);
    
    const colors = ['#1a1a2a', '#1a2a2a', '#2a1a1a', '#1a2a1a'];
    
    for (let layer = 0; layer < 4; layer++) {
      ctx.fillStyle = colors[layer];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      
      const baseHeight = 100 + layer * 60;
      for (let x = 0; x <= viewWidth; x += 4) {
        const noise = Math.sin(x * 0.01 + time * 0.1 + layer) * 30;
        const buildingHeight = baseHeight + noise + Math.sin(x * 0.05 + layer * 2) * 40;
        ctx.lineTo(x, -buildingHeight);
      }
      
      ctx.lineTo(viewWidth, 0);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  function drawDeadScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    
    ctx.font = 'bold 64px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#c82020';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', viewWidth/2, viewHeight/2 - 60);
    
    ctx.font = '22px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef1f5';
    ctx.fillText('Press SPACE to respawn', viewWidth/2, viewHeight/2 + 20);
    
    ctx.font = '18px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8b93a3';
    ctx.fillText(`Lost $${Math.floor(hud.money * 0.1)} | Weapons confiscated`, viewWidth/2, viewHeight/2 + 60);
    
    ctx.textAlign = 'left';
  }
  
  function draw(ctx) {
    if (gameState === 'menu') {
      drawMenu(ctx);
    } else if (gameState === 'paused') {
      drawPauseMenu(ctx);
    } else if (gameState === 'dead') {
      drawDeadScreen(ctx);
    }
  }
  
  function update(dt) {
    if (gameState === 'playing' && player.wasted) {
      gameState = 'dead';
    } else if (gameState === 'dead' && !player.wasted) {
      gameState = 'playing';
    }
  }
  
  function getState() { return gameState; }
  function setState(s) { gameState = s; }
  
  init();
  
  return {
    update,
    draw,
    getState,
    setState,
    startNewGame,
    pauseGame,
    resumeGame,
    saveGame,
    loadGame,
    loadSaveSlots,
    get menuSelection() { return menuSelection; },
    get inSettings() { return inSettings; },
    get showControls() { return showControls; }
  };
}
