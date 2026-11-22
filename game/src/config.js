// Sunfall City - Configuration constants
// All tuning numbers, colors, and game parameters in one place

export const WORLD = {
  // City grid: 3x larger than you think - 48x48 blocks, each 128px = 6144x6144 world
  blockSize: 128,
  gridWidth: 48,
  gridHeight: 48,
  worldWidth: 48 * 128,
  worldHeight: 48 * 128,
  // Logical render size (fixed, scaled to window)
  viewWidth: 1280,
  viewHeight: 720,
};

export const STEP = 1 / 60; // Fixed timestep

export const PLAYER = {
  radius: 14,
  speed: 220,
  sprintSpeed: 380,
  sprintStamina: 100,
  sprintRegen: 15,
  sprintDrain: 30,
  enterCarRange: 40,
  maxHealth: 100,
  maxArmor: 100,
  fistDamage: 15,
  fistRange: 32,
  fistCooldown: 0.4,
  gunDamage: 35,
  gunRange: 400,
  gunCooldown: 0.18,
  ammoCapacity: 120,
  respawnInvuln: 2.0,
};

export const VEHICLE = {
  // Car types: { name, color, maxSpeed, acceleration, turnRate, handbrakeTurn, mass, width, length, spawnWeight }
  types: [
    { name: 'Sultan', color: '#c82020', maxSpeed: 320, accel: 180, turn: 3.2, hbTurn: 5.5, mass: 1400, w: 28, l: 56, weight: 10 },
    { name: 'Vantage', color: '#1a1a2e', maxSpeed: 380, accel: 220, turn: 3.5, hbTurn: 6.0, mass: 1600, w: 30, l: 58, weight: 8 },
    { name: 'Brawler', color: '#2d5a27', maxSpeed: 280, accel: 150, turn: 2.8, hbTurn: 5.0, mass: 1800, w: 32, l: 60, weight: 7 },
    { name: 'Drift', color: '#e8a838', maxSpeed: 350, accel: 200, turn: 3.8, hbTurn: 6.5, mass: 1300, w: 28, l: 54, weight: 6 },
    { name: 'Hauler', color: '#3a3a3a', maxSpeed: 220, accel: 100, turn: 2.2, hbTurn: 3.5, mass: 2500, w: 36, l: 72, weight: 5 },
    { name: 'Patrol', color: '#1a3a5c', maxSpeed: 340, accel: 190, turn: 3.3, hbTurn: 5.5, mass: 1700, w: 30, l: 58, weight: 0 }, // Police only
    { name: 'Interceptor', color: '#0d1b2a', maxSpeed: 400, accel: 240, turn: 3.8, hbTurn: 6.5, mass: 1500, w: 28, l: 56, weight: 0 }, // High wanted
    { name: 'Beater', color: '#5a4a3a', maxSpeed: 200, accel: 80, turn: 2.5, hbTurn: 4.0, mass: 1500, w: 28, l: 56, weight: 8 },
    { name: 'Cruiser', color: '#8b6a4a', maxSpeed: 250, accel: 120, turn: 2.6, hbTurn: 4.5, mass: 1600, w: 30, l: 60, weight: 7 },
    { name: 'Sports', color: '#c83838', maxSpeed: 420, accel: 260, turn: 4.0, hbTurn: 7.0, mass: 1400, w: 28, l: 54, weight: 4 },
  ],
  // Traffic
  trafficDensity: 0.15,
  trafficSpeed: 0.6, // fraction of maxSpeed
  trafficSpacing: 200,
  parkedDensity: 0.08,
  policeSpawnChase: 0.7, // probability to spawn ahead
  policeSpawnRoadblock: 0.3,
};

export const PED = {
  radius: 12,
  walkSpeed: 60,
  runSpeed: 160,
  fleeSpeed: 200,
  sidewalkMargin: 16,
  density: 0.02,
  viewRange: 200,
  hearRange: 150,
  panicTime: 8.0,
  types: [
    { color: '#d4a574', weight: 25 }, // civilian
    { color: '#a8c8e8', weight: 20 }, // business
    { color: '#e8b874', weight: 15 }, // tourist
    { color: '#88aa88', weight: 15 }, // worker
    { color: '#c88888', weight: 10 }, // punk
    { color: '#a8a8a8', weight: 15 }, // elderly
  ],
};

export const COMBAT = {
  bulletSpeed: 800,
  bulletLifetime: 0.8,
  bulletRadius: 3,
  muzzleFlashTime: 0.06,
  bloodParticles: 8,
  bloodLifetime: 0.6,
  gunPickupAmmo: 30,
  healthPickupAmount: 40,
  armorPickupAmount: 30,
  pickupRadius: 20,
  pickupRespawn: 30.0,
};

export const POLICE = {
  maxStars: 5,
  starDecay: [0.5, 0.4, 0.3, 0.25, 0.2], // per second at each star level
  // Crimes and star values
  crimes: {
    hitPedestrian: 1,
    killPedestrian: 2,
    stealCar: 1,
    hitCopCar: 2,
    shootGun: 2,
    shootCop: 3,
    killCop: 4,
    ramCop: 2,
  },
  // Response per star
  response: {
    1: { patrolCars: 1, shoot: false, roadblocks: false, heli: false },
    2: { patrolCars: 2, shoot: true, roadblocks: false, heli: false },
    3: { patrolCars: 3, shoot: true, roadblocks: true, heli: false },
    4: { patrolCars: 4, shoot: true, roadblocks: true, heli: true, swat: true },
    5: { patrolCars: 5, shoot: true, roadblocks: true, heli: true, swat: true, military: true },
  },
  chaseRange: 500,
  giveUpRange: 800,
  giveUpTime: 15.0,
  roadblockDistance: 300,
};

export const MISSIONS = [
  {
    id: 'intro',
    title: 'Arrival',
    giver: 'Mara',
    location: { x: 3072, y: 3072 }, // downtown center
    steps: [
      { type: 'goto', target: { x: 3200, y: 2800 }, desc: 'Meet Mara at the Sunfall Docks' },
      { type: 'dialogue', text: 'Welcome to Sunfall City. I\'m Mara. You\'re new here, so listen close. This city runs on respect and credits. First job: grab that Beater parked nearby and drive it to the garage.' },
      { type: 'enterVehicle', desc: 'Steal the marked vehicle' },
      { type: 'drive', target: { x: 3600, y: 3400 }, radius: 60, desc: 'Deliver the car to the chop shop' },
      { type: 'dialogue', text: 'Good. The boss will be in touch. Keep your head down and your piece ready.' },
    ],
    reward: { money: 500, unlock: 'contact_mara' },
  },
  {
    id: 'delivery',
    title: 'Midnight Run',
    giver: 'Mara',
    location: { x: 3600, y: 3400 },
    requires: 'contact_mara',
    steps: [
      { type: 'dialogue', text: 'Got a package needs moving across town. Industrial district to the beach. Don\'t get pulled over - the heat\'s been heavy lately.' },
      { type: 'goto', target: { x: 1200, y: 5200 }, desc: 'Pick up the package at the warehouse' },
      { type: 'dialogue', text: 'Package secured. Now haul it to the drop on Marina Beach. Watch for roadblocks.' },
      { type: 'drive', target: { x: 5200, y: 1800 }, radius: 80, desc: 'Deliver to Marina Beach' },
      { type: 'dialogue', text: 'Clean delivery. The Vipers won\'t know what hit \'em. Here\'s your cut.' },
    ],
    reward: { money: 1500, unlock: 'contact_viktor' },
  },
  {
    id: 'heist_prep',
    title: 'Casing the Joint',
    giver: 'Viktor',
    location: { x: 1000, y: 5000 },
    requires: 'contact_viktor',
    steps: [
      { type: 'dialogue', text: 'You\'re building a rep. Good. The Meridian Bank in Downtown holds a score that\'ll set us up proper. But we need eyes inside first. Go scope it out - take photos of the security, the patrol routes, the vault entrance.' },
      { type: 'goto', target: { x: 3000, y: 2900 }, radius: 40, desc: 'Survey the Meridian Bank' },
      { type: 'dialogue', text: 'Nice work. Heavy security - two guards at the front, cameras everywhere. We\'ll need a distraction. Steal a police cruiser and park it near the precinct to draw heat away.' },
      { type: 'goto', target: { x: 2800, y: 2600 }, desc: 'Steal a police cruiser' },
      { type: 'drive', target: { x: 3400, y: 2400 }, radius: 50, desc: 'Park cruiser near precinct' },
      { type: 'dialogue', text: 'Distraction\'s in place. Now we wait for the signal. Meet me at the safehouse.' },
    ],
    reward: { money: 2000, unlock: 'heist_ready' },
  },
  {
    id: 'heist',
    title: 'The Meridian Job',
    giver: 'Viktor',
    location: { x: 3400, y: 2400 },
    requires: 'heist_ready',
    steps: [
      { type: 'dialogue', text: 'This is it. The Meridian Bank. Go in loud, grab the bags, get out. Mara\'s waiting with a getaway car at the alley behind the bank. Don\'t die.' },
      { type: 'goto', target: { x: 3000, y: 2900 }, radius: 30, desc: 'Enter Meridian Bank' },
      { type: 'dialogue', text: '*ALARM BLARES* Vault\'s open! Grab the cash - three bags!' },
      { type: 'collect', count: 3, target: { x: 3000, y: 2880 }, radius: 50, desc: 'Collect 3 cash bags' },
      { type: 'dialogue', text: 'Got it all! Now MOVE! Cops incoming!' },
      { type: 'drive', target: { x: 2600, y: 3200 }, radius: 60, desc: 'Escape to Mara\'s getaway car' },
      { type: 'dialogue', text: 'We lost \'em! Split\'s clean. You\'ve earned every credit of this.' },
    ],
    reward: { money: 10000, unlock: 'endgame' },
  },
  {
    id: 'turf_war',
    title: 'Turf War',
    giver: 'Mara',
    location: { x: 2600, y: 3200 },
    requires: 'endgame',
    steps: [
      { type: 'dialogue', text: 'The Vipers are moving on our docks. Viktor wants them pushed back. Take the fight to them - clear three Viper hangouts in the Industrial zone.' },
      { type: 'goto', target: { x: 1400, y: 5000 }, radius: 50, desc: 'Clear Viper hangout 1' },
      { type: 'kill', count: 5, desc: 'Eliminate 5 Vipers' },
      { type: 'goto', target: { x: 1000, y: 5400 }, radius: 50, desc: 'Clear Viper hangout 2' },
      { type: 'kill', count: 5, desc: 'Eliminate 5 Vipers' },
      { type: 'goto', target: { x: 1600, y: 4800 }, radius: 50, desc: 'Clear Viper hangout 3' },
      { type: 'kill', count: 5, desc: 'Eliminate 5 Vipers' },
      { type: 'dialogue', text: 'The Vipers are broken. Sunfall\'s docks are ours again. You\'re a legend in this city now.' },
    ],
    reward: { money: 5000, unlock: 'kingpin' },
  },
];

export const DISTRICTS = {
  downtown: { name: 'Downtown', color: '#2a2a3a', roadColor: '#3a3a4a', buildingColors: ['#3a3a4a', '#4a4a5a', '#2a2a3a'], windowColor: '#ffe8a0', parks: true },
  beach: { name: 'Marina Beach', color: '#1a3a4a', roadColor: '#2a4a5a', buildingColors: ['#3a5a6a', '#4a6a7a', '#2a4a5a'], windowColor: '#ffe0c0', sandColor: '#e8d8b0', waterColor: '#1a4a6a' },
  suburbs: { name: 'Hillside', color: '#2a3a2a', roadColor: '#3a4a3a', buildingColors: ['#4a5a4a', '#5a6a5a', '#3a4a3a'], windowColor: '#fff0d0', grassColor: '#3a5a3a' },
  industrial: { name: 'Iron District', color: '#3a2a2a', roadColor: '#4a3a3a', buildingColors: ['#4a4a4a', '#5a5a5a', '#3a3a3a'], windowColor: '#e8e8d0', factoryColor: '#4a3a3a' },
  park: { name: 'Central Park', color: '#1a3a1a', roadColor: '#2a4a2a', buildingColors: ['#2a4a2a'], windowColor: '#fff8e0', grassColor: '#2a5a2a', treeColor: '#1a4a1a' },
  water: { color: '#0a2a4a', deepColor: '#081a3a' },
};

export const AUDIO = {
  masterVolume: 0.5,
  sfxVolume: 0.6,
  musicVolume: 0.3,
  engineBaseFreq: 60,
  engineHarmonics: 6,
  sirenFreq: 800,
  sirenMod: 6,
  gunshotFreq: 120,
  gunshotDecay: 0.08,
};

export const HUD = {
  minimapSize: 180,
  minimapZoom: 0.015,
  healthBarWidth: 200,
  healthBarHeight: 18,
  armorBarHeight: 8,
  starSize: 24,
  fontSize: 13,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const SAVE_KEY = 'sunfall_city_save';

export const TIME = {
  dayLength: 1200, // seconds for full day-night cycle
  nightStart: 0.75, // 0-1 fraction
  nightEnd: 0.25,
};
