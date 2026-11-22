// Sunfall City - Audio system
// WebAudio procedural sounds: engine, gunshots, sirens, etc.

import { AUDIO } from './config.js';

export function createAudioSystem() {
  const { masterVolume, sfxVolume, musicVolume, 
          engineBaseFreq, engineHarmonics, sirenFreq, sirenMod,
          gunshotFreq, gunshotDecay } = AUDIO;
  
  let audioContext = null;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  
  // Sound pools for overlapping sounds
  const engineSounds = new Map(); // vehicle -> { oscillator, gain, filter }
  const sirenSounds = new Map(); // vehicle -> { oscillator, gain, lfo }
  
  function init() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioContext.destination);
    
    sfxGain = audioContext.createGain();
    sfxGain.gain.value = sfxVolume;
    sfxGain.connect(masterGain);
    
    musicGain = audioContext.createGain();
    musicGain.gain.value = musicVolume;
    musicGain.connect(masterGain);
    
    // Resume on user interaction
    document.addEventListener('click', () => {
      if (audioContext.state === 'suspended') audioContext.resume();
    }, { once: true });
    document.addEventListener('keydown', () => {
      if (audioContext.state === 'suspended') audioContext.resume();
    }, { once: true });
  }
  
  function ensureContext() {
    if (!audioContext) init();
    if (audioContext.state === 'suspended') audioContext.resume();
  }
  
  // Engine sound for a vehicle
  function playEngine(vehicle) {
    ensureContext();
    if (engineSounds.has(vehicle)) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.value = engineBaseFreq;
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;
    
    gain.gain.value = 0.05;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start();
    
    engineSounds.set(vehicle, { osc, gain, filter });
  }
  
  function updateEngineSound(vehicle, rpm) {
    ensureContext();
    const sound = engineSounds.get(vehicle);
    if (!sound) {
      if (rpm > 0.1) playEngine(vehicle);
      return;
    }
    
    if (rpm < 0.05) {
      stopEngine(vehicle);
      return;
    }
    
    // Frequency based on RPM
    const baseFreq = engineBaseFreq;
    const maxFreq = engineBaseFreq * 4;
    sound.osc.frequency.setTargetAtTime(
      baseFreq + (maxFreq - baseFreq) * rpm,
      audioContext.currentTime, 0.05
    );
    
    // Filter opens with RPM
    sound.filter.frequency.setTargetAtTime(
      200 + 2000 * rpm,
      audioContext.currentTime, 0.05
    );
    
    // Volume
    sound.gain.gain.setTargetAtTime(
      0.03 + 0.15 * rpm,
      audioContext.currentTime, 0.05
    );
  }
  
  function stopEngine(vehicle) {
    const sound = engineSounds.get(vehicle);
    if (!sound) return;
    
    sound.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
    setTimeout(() => {
      try { sound.osc.stop(); } catch {}
      engineSounds.delete(vehicle);
    }, 200);
  }
  
  // Siren sound
  function playSiren(vehicle) {
    ensureContext();
    if (sirenSounds.has(vehicle)) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.value = sirenFreq;
    
    lfo.type = 'sine';
    lfo.frequency.value = sirenMod;
    lfoGain.gain.value = 400; // Frequency modulation depth
    
    gain.gain.value = 0.15;
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start();
    lfo.start();
    
    sirenSounds.set(vehicle, { osc, gain, lfo, lfoGain });
  }
  
  function updateSirenSound(vehicle) {
    ensureContext();
    const sound = sirenSounds.get(vehicle);
    if (!sound) {
      playSiren(vehicle);
      return;
    }
    
    // Alternate between wail and yelp
    const time = audioContext.currentTime;
    const cycle = Math.floor(time / 3) % 2;
    if (cycle === 0) {
      sound.lfo.frequency.setTargetAtTime(6, time, 0.1);
      sound.osc.frequency.setTargetAtTime(800, time, 0.1);
    } else {
      sound.lfo.frequency.setTargetAtTime(12, time, 0.1);
      sound.osc.frequency.setTargetAtTime(1000, time, 0.1);
    }
  }
  
  function stopSiren(vehicle) {
    const sound = sirenSounds.get(vehicle);
    if (!sound) return;
    
    sound.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.2);
    setTimeout(() => {
      try { sound.osc.stop(); sound.lfo.stop(); } catch {}
      sirenSounds.delete(vehicle);
    }, 300);
  }
  
  // Gunshot
  function playGunshot(x = 0, y = 0, isPolice = false) {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.value = gunshotFreq * (isPolice ? 0.8 : 1);
    
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.3 * sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + gunshotDecay);
    
    // Pitch drop
    osc.frequency.setValueAtTime(gunshotFreq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(gunshotFreq * 0.3, now + gunshotDecay);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + gunshotDecay * 2);
  }
  
  // Punch
  function playPunch() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.value = 120;
    
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }
  
  // Hit
  function playHit() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 180;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
  
  // Ped scream
  function playPedScream(ped) {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 400 + Math.random() * 400;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }
  
  function playPedDeath() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 200;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 1);
  }
  
  // Enter/exit car
  function playEnterCar() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.value = 150;
    
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }
  
  function playExitCar() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 100;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }
  
  // Wasted
  function playWasted() {
    ensureContext();
    
    // Downward glissando
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine';
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 2);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 2.5);
  }
  
  // Busted
  function playBusted() {
    ensureContext();
    
    // Police siren short burst
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    
    osc.type = 'square';
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    lfoGain.gain.value = 500;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.5);
    lfo.stop(now + 1.5);
  }
  
  // Respawn
  function playRespawn() {
    ensureContext();
    
    // Upward chime
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const now = audioContext.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.connect(gain);
      gain.connect(sfxGain);
      
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }
  
  // Pickup
  function playPickup() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 880;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }
  
  // Mission start/complete
  function playMissionStart() {
    ensureContext();
    
    const notes = [440, 554, 659]; // A4, C#5, E5
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = 'triangle';
      osc.frequency.value = freq;
      
      const now = audioContext.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc.connect(gain);
      gain.connect(sfxGain);
      
      osc.start(now);
      osc.stop(now + 0.5);
    });
  }
  
  function playMissionComplete() {
    ensureContext();
    
    const notes = [523, 659, 784, 1047, 1318]; // Major chord up
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      const now = audioContext.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.connect(gain);
      gain.connect(sfxGain);
      
      osc.start(now);
      osc.stop(now + 0.7);
    });
  }
  
  // Helicopter
  function playHeli() {
    ensureContext();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'square';
    osc.frequency.value = 30;
    
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    
    gain.gain.value = 0.05;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start();
    
    // Store for later stop
    if (!window._heliSound) window._heliSound = { osc, gain };
  }
  
  function stopHeli() {
    if (window._heliSound) {
      window._heliSound.gain.gain.setTargetAtTime(0, audioContext.currentTime, 1);
      setTimeout(() => {
        try { window._heliSound.osc.stop(); } catch {}
        window._heliSound = null;
      }, 1500);
    }
  }
  
  // Explosion
  function playExplosion(x, y) {
    ensureContext();
    
    // Low rumble
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 1.5);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    
    osc.start(now);
    osc.stop(now + 2);
    
    // Noise burst for debris
    const bufferSize = audioContext.sampleRate * 0.5;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    
    const noise = audioContext.createBufferSource();
    const noiseGain = audioContext.createGain();
    const noiseFilter = audioContext.createBiquadFilter();
    
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 2;
    
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(sfxGain);
    
    noise.start(now);
  }
  
  function setMasterVolume(v) {
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
  }
  
  function setSfxVolume(v) {
    if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, v));
  }
  
  function setMusicVolume(v) {
    if (musicGain) musicGain.gain.value = Math.max(0, Math.min(1, v));
  }
  
  return {
    init,
    playEngine,
    updateEngineSound,
    stopEngine,
    playSiren,
    updateSirenSound,
    stopSiren,
    playGunshot,
    playPunch,
    playHit,
    playPedScream,
    playPedDeath,
    playEnterCar,
    playExitCar,
    playWasted,
    playBusted,
    playRespawn,
    playPickup,
    playMissionStart,
    playMissionComplete,
    playHeli,
    stopHeli,
    playExplosion,
    setMasterVolume,
    setSfxVolume,
    setMusicVolume,
    get context() { return audioContext; }
  };
}
