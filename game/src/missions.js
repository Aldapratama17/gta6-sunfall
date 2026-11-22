// Sunfall City - Mission system
// Story missions with objectives, waypoints, dialogue, rewards

import { MISSIONS, WORLD } from './config.js';

export function createMissionSystem(city, player, police, vehicles, audio, hud) {
  const { blockSize, worldWidth, worldHeight } = WORLD;
  
  // Mission state
  let currentMission = null;
  let currentStep = 0;
  let missionProgress = {};
  let unlockedContacts = new Set();
  let completedMissions = new Set();
  let availableMissions = [];
  let missionMarkers = []; // Waypoint markers on map
  
  // Dialogue system
  let dialogueActive = false;
  let dialogueText = '';
  let dialogueLines = [];
  let dialogueIndex = 0;
  let dialogueCharacter = '';
  let dialogueOnComplete = null;
  
  // Mission triggers (locations where missions can be started)
  const missionTriggers = [];
  
  function initMissions() {
    // Build available missions list
    availableMissions = MISSIONS.filter(m => !completedMissions.has(m.id));
    
    // Create mission triggers
    for (const m of MISSIONS) {
      if (completedMissions.has(m.id)) continue;
      if (m.requires && !unlockedContacts.has(m.requires)) continue;
      
      missionTriggers.push({
        missionId: m.id,
        x: m.location.x,
        y: m.location.y,
        radius: 40,
        giver: m.giver,
        title: m.title
      });
    }
  }
  
  function checkMissionTriggers() {
    if (currentMission || player.inVehicle) return;
    
    for (const trigger of missionTriggers) {
      const dx = player.x - trigger.x;
      const dy = player.y - trigger.y;
      if (Math.hypot(dx, dy) < trigger.radius) {
        startMission(trigger.missionId);
        break;
      }
    }
  }
  
  function startMission(missionId) {
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) return;
    if (completedMissions.has(missionId)) return;
    if (mission.requires && !unlockedContacts.has(mission.requires)) return;
    
    currentMission = mission;
    currentStep = 0;
    missionProgress = {};
    dialogueActive = false;
    
    // Remove trigger
    const idx = missionTriggers.findIndex(t => t.missionId === missionId);
    if (idx >= 0) missionTriggers.splice(idx, 1);
    
    // Start first step
    advanceMissionStep();
    
    hud.showMissionStart(mission.title);
    audio.playMissionStart();
  }
  
  function advanceMissionStep() {
    if (!currentMission || currentStep >= currentMission.steps.length) {
      completeMission();
      return;
    }
    
    const step = currentMission.steps[currentStep];
    
    switch (step.type) {
      case 'goto':
        createWaypoint(step.target.x, step.target.y, step.radius || 30, step.desc);
        break;
      case 'drive':
        createWaypoint(step.target.x, step.target.y, step.radius || 50, step.desc);
        break;
      case 'dialogue':
        showDialogue(step.text, mission.giver, () => {
          currentStep++;
          advanceMissionStep();
        });
        return; // Don't auto-advance
      case 'enterVehicle':
        hud.setObjective(step.desc);
        break;
      case 'collect':
        missionProgress.collected = 0;
        missionProgress.targetCount = step.count;
        missionProgress.collectTarget = step.target;
        missionProgress.collectRadius = step.radius;
        createWaypoint(step.target.x, step.target.y, step.radius, step.desc);
        break;
      case 'kill':
        missionProgress.killed = 0;
        missionProgress.targetKills = step.count;
        hud.setObjective(step.desc);
        break;
    }
    
    hud.setObjective(step.desc);
  }
  
  function createWaypoint(x, y, radius, desc) {
    missionMarkers = [{
      x, y, radius,
      desc,
      color: '#4fc3f7',
      pulse: 0
    }];
  }
  
  function showDialogue(text, character, onComplete) {
    dialogueActive = true;
    dialogueText = text;
    dialogueCharacter = character;
    dialogueOnComplete = onComplete;
    
    // Split into lines for display
    const words = text.split(' ');
    dialogueLines = [];
    let line = '';
    for (const word of words) {
      if (line.length + word.length > 45) {
        dialogueLines.push(line);
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line) dialogueLines.push(line);
    dialogueIndex = 0;
    
    hud.showDialogue(dialogueLines[0], character);
  }
  
  function continueDialogue() {
    if (!dialogueActive) return;
    
    dialogueIndex++;
    if (dialogueIndex < dialogueLines.length) {
      hud.showDialogue(dialogueLines[dialogueIndex], dialogueCharacter);
    } else {
      dialogueActive = false;
      hud.hideDialogue();
      if (dialogueOnComplete) {
        const cb = dialogueOnComplete;
        dialogueOnComplete = null;
        cb();
      }
    }
  }
  
  function updateMission(dt) {
    if (!currentMission) {
      checkMissionTriggers();
      return;
    }
    
    // Update waypoint pulse
    for (const m of missionMarkers) {
      m.pulse += dt * 3;
    }
    
    if (dialogueActive) return;
    
    const step = currentMission.steps[currentStep];
    if (!step) return;
    
    switch (step.type) {
      case 'goto':
        checkGotoStep(step);
        break;
      case 'drive':
        checkDriveStep(step);
        break;
      case 'enterVehicle':
        if (player.inVehicle) {
          currentStep++;
          advanceMissionStep();
        }
        break;
      case 'collect':
        checkCollectStep(step);
        break;
      case 'kill':
        // Checked externally when peds die
        if (missionProgress.killed >= missionProgress.targetKills) {
          currentStep++;
          advanceMissionStep();
        }
        break;
    }
  }
  
  function checkGotoStep(step) {
    const dx = player.x - step.target.x;
    const dy = player.y - step.target.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (step.radius || 30)) {
      missionMarkers = [];
      currentStep++;
      advanceMissionStep();
    }
  }
  
  function checkDriveStep(step) {
    if (!player.inVehicle) return;
    const dx = player.currentVehicle.x - step.target.x;
    const dy = player.currentVehicle.y - step.target.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (step.radius || 50)) {
      missionMarkers = [];
      currentStep++;
      advanceMissionStep();
    }
  }
  
  function checkCollectStep(step) {
    const dx = player.x - step.target.x;
    const dy = player.y - step.target.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (step.radius || 30)) {
      missionProgress.collected++;
      audio.playPickup();
      if (missionProgress.collected >= missionProgress.targetCount) {
        missionMarkers = [];
        currentStep++;
        advanceMissionStep();
      } else {
        hud.setObjective(`Collected ${missionProgress.collected}/${missionProgress.targetCount}`);
      }
    }
  }
  
  function onPedKilled(ped, byPlayer) {
    if (!currentMission || !byPlayer) return;
    const step = currentMission.steps[currentStep];
    if (step && step.type === 'kill') {
      missionProgress.killed++;
      hud.setObjective(`Eliminated ${missionProgress.killed}/${missionProgress.targetKills}`);
    }
  }
  
  function onVehicleStolen(veh) {
    if (!currentMission) return;
    const step = currentMission.steps[currentStep];
    if (step && step.type === 'enterVehicle') {
      currentStep++;
      advanceMissionStep();
    }
  }
  
  function completeMission() {
    if (!currentMission) return;
    
    const mission = currentMission;
    currentMission = null;
    currentStep = 0;
    missionProgress = {};
    missionMarkers = [];
    
    completedMissions.add(mission.id);
    
    // Grant rewards
    if (mission.reward.money) {
      player.addMoney(mission.reward.money);
    }
    if (mission.reward.unlock) {
      unlockedContacts.add(mission.reward.unlock);
    }
    
    // Rebuild available missions
    initMissions();
    
    hud.showMissionComplete(mission.title, mission.reward.money);
    audio.playMissionComplete();
  }
  
  function getMissionMarker() {
    return missionMarkers[0] || null;
  }
  
  function getState() {
    return {
      currentMission: currentMission ? currentMission.id : null,
      currentStep,
      missionProgress,
      completedMissions: Array.from(completedMissions),
      unlockedContacts: Array.from(unlockedContacts),
      dialogueActive,
      dialogueText: dialogueLines[dialogueIndex] || '',
      dialogueCharacter,
      availableMissions: availableMissions.map(m => ({ id: m.id, title: m.title, giver: m.giver }))
    };
  }
  
  function loadState(state) {
    completedMissions = new Set(state.completedMissions || []);
    unlockedContacts = new Set(state.unlockedContacts || []);
    initMissions();
  }
  
  initMissions();
  
  return {
    update: updateMission,
    continueDialogue,
    onPedKilled,
    onVehicleStolen,
    getMissionMarker,
    getState,
    loadState,
    startMission,
    get currentMission() { return currentMission; },
    get dialogueActive() { return dialogueActive; }
  };
}
