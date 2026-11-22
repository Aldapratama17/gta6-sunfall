// Sunfall City - City generation and rendering
// Procedural city with districts, roads, sidewalks, buildings, parks, water

import { WORLD, DISTRICTS } from './config.js';

const { blockSize, gridWidth, gridHeight } = WORLD;
const worldWidth = gridWidth * blockSize;
const worldHeight = gridHeight * blockSize;

// District layout - each cell is a block
const districtMap = new Uint8Array(gridWidth * gridHeight);
// 0=downtown, 1=beach, 2=suburbs, 3=industrial, 4=park, 5=water

// Road network: each block edge can have a road
const hRoads = new Uint8Array(gridWidth * (gridHeight + 1)); // horizontal roads
const vRoads = new Uint8Array((gridWidth + 1) * gridHeight); // vertical roads
// Road types: 0=none, 1=street, 2=avenue, 3=highway

// Building data per block
const buildings = []; // { x, y, w, h, color, windowColor, floors, windows: [] }

// Park areas
const parks = []; // { x, y, w, h, type }

// Water bodies
const waterBodies = []; // { x, y, w, h, deep }

// Deterministic random
let citySeed = 0;
function cityRandom() {
  citySeed = (citySeed * 1664525 + 1013904223) >>> 0;
  return citySeed / 4294967296;
}
function cityRandomSeed(s) { citySeed = s; }

function districtAt(bx, by) {
  if (bx < 0 || bx >= gridWidth || by < 0 || by >= gridHeight) return 0;
  return districtMap[by * gridWidth + bx];
}

function setDistrict(bx, by, d) {
  if (bx >= 0 && bx < gridWidth && by >= 0 && by < gridHeight) {
    districtMap[by * gridWidth + bx] = d;
  }
}

function paintDistrict(cx, cy, radius, district) {
  for (let by = -radius; by <= radius; by++) {
    for (let bx = -radius; bx <= radius; bx++) {
      if (bx * bx + by * by <= radius * radius) {
        setDistrict(cx + bx, cy + by, district);
      }
    }
  }
}

function generateDistricts() {
  // Clear
  districtMap.fill(0);
  
  // Downtown - center
  paintDistrict(24, 24, 8, 0);
  
  // Beach - bottom right
  paintDistrict(40, 40, 10, 1);
  
  // Suburbs - top left
  paintDistrict(8, 8, 10, 2);
  
  // Industrial - bottom left
  paintDistrict(8, 40, 10, 3);
  
  // Park - top right
  paintDistrict(40, 8, 7, 4);
  
  // Water - edges and around beach
  for (let by = 0; by < gridHeight; by++) {
    for (let bx = 0; bx < gridWidth; bx++) {
      const d = districtAt(bx, by);
      if (d === 1 && (bx > 38 || by > 38)) setDistrict(bx, by, 5);
      if (bx === 0 || bx === gridWidth - 1 || by === 0 || by === gridHeight - 1) {
        if (cityRandom() < 0.3) setDistrict(bx, by, 5);
      }
    }
  }
  
  // Bridge connections - ensure roads connect districts
  // Downtown to beach
  for (let i = 24; i <= 38; i++) setDistrict(i, 30, 0);
  // Downtown to industrial
  for (let i = 10; i <= 24; i++) setDistrict(i, 30, 0);
  // Downtown to suburbs
  for (let i = 10; i <= 24; i++) setDistrict(16, i, 0);
  // Downtown to park
  for (let i = 24; i <= 38; i++) setDistrict(32, i, 0);
}

function generateRoads() {
  hRoads.fill(0);
  vRoads.fill(0);
  
  // Main avenues (every 4 blocks)
  for (let by = 0; by <= gridHeight; by += 4) {
    for (let bx = 0; bx < gridWidth; bx++) {
      hRoads[by * gridWidth + bx] = 2; // avenue
    }
  }
  for (let bx = 0; bx <= gridWidth; bx += 4) {
    for (let by = 0; by < gridHeight; by++) {
      vRoads[bx * gridHeight + by] = 2;
    }
  }
  
  // Streets (every 2 blocks between avenues)
  for (let by = 2; by < gridHeight; by += 4) {
    for (let bx = 0; bx < gridWidth; bx++) {
      if (hRoads[by * gridWidth + bx] === 0) hRoads[by * gridWidth + bx] = 1;
    }
  }
  for (let bx = 2; bx < gridWidth; bx += 4) {
    for (let by = 0; by < gridHeight; by++) {
      if (vRoads[bx * gridHeight + by] === 0) vRoads[bx * gridHeight + by] = 1;
    }
  }
  
  // Highways - major corridors
  // Horizontal highway through downtown
  const hy = 24;
  for (let bx = 0; bx < gridWidth; bx++) hRoads[hy * gridWidth + bx] = 3;
  // Vertical highway
  const hx = 24;
  for (let by = 0; by < gridHeight; by++) vRoads[hx * gridHeight + by] = 3;
  
  // Beach boulevard
  for (let bx = 30; bx < gridWidth; bx++) hRoads[36 * gridWidth + bx] = 3;
  
  // Ensure district centers have road access
  const centers = [
    { x: 24, y: 24 }, // downtown
    { x: 40, y: 38 }, // beach
    { x: 12, y: 12 }, // suburbs
    { x: 12, y: 38 }, // industrial
    { x: 38, y: 12 }, // park
  ];
  
  for (const c of centers) {
    // Connect to nearest avenue
    const ax = Math.round(c.x / 4) * 4;
    const ay = Math.round(c.y / 4) * 4;
    for (let bx = Math.min(c.x, ax); bx <= Math.max(c.x, ax); bx++) {
      if (bx < gridWidth) hRoads[c.y * gridWidth + bx] = Math.max(hRoads[c.y * gridWidth + bx], 2);
    }
    for (let by = Math.min(c.y, ay); by <= Math.max(c.y, ay); by++) {
      if (by < gridHeight) vRoads[c.x * gridHeight + by] = Math.max(vRoads[c.x * gridHeight + by], 2);
    }
  }
  
  // Water blocks don't have roads
  for (let by = 0; by <= gridHeight; by++) {
    for (let bx = 0; bx < gridWidth; bx++) {
      if (by > 0 && districtAt(bx, by - 1) === 5 && districtAt(bx, by) === 5) {
        hRoads[by * gridWidth + bx] = 0;
      }
      if (by < gridHeight && districtAt(bx, by) === 5 && districtAt(bx, by + 1) === 5) {
        hRoads[by * gridWidth + bx] = 0;
      }
    }
  }
  for (let bx = 0; bx <= gridWidth; bx++) {
    for (let by = 0; by < gridHeight; by++) {
      if (bx > 0 && districtAt(bx - 1, by) === 5 && districtAt(bx, by) === 5) {
        vRoads[bx * gridHeight + by] = 0;
      }
      if (bx < gridWidth && districtAt(bx, by) === 5 && districtAt(bx + 1, by) === 5) {
        vRoads[bx * gridHeight + by] = 0;
      }
    }
  }
}

function generateBuildings() {
  buildings.length = 0;
  
  for (let by = 0; by < gridHeight; by++) {
    for (let bx = 0; bx < gridWidth; bx++) {
      const district = districtAt(bx, by);
      if (district === 5) continue; // water
      
      const dist = DISTRICTS[Object.keys(DISTRICTS)[district]];
      if (!dist) continue;
      
      // Check if this block has road access
      const hasRoad = 
        (by > 0 && hRoads[by * gridWidth + bx] > 0) ||
        (by < gridHeight && hRoads[(by + 1) * gridWidth + bx] > 0) ||
        (bx > 0 && vRoads[bx * gridHeight + by] > 0) ||
        (bx < gridWidth && vRoads[(bx + 1) * gridHeight + by] > 0);
      
      if (!hasRoad && cityRandom() > 0.1) continue;
      
      // Building density by district
      let density = 0.7;
      if (district === 1) density = 0.5; // beach - less dense
      if (district === 2) density = 0.6; // suburbs
      if (district === 3) density = 0.8; // industrial - dense
      if (district === 4) density = 0.1; // park - rare
      
      if (cityRandom() > density) continue;
      
      // Building size - can span multiple blocks
      const maxW = district === 3 ? 3 : 2; // industrial wider
      const maxH = district === 0 ? 3 : 2; // downtown taller
      const bw = 1 + Math.floor(cityRandom() * maxW);
      const bh = 1 + Math.floor(cityRandom() * maxH);
      
      // Check bounds
      if (bx + bw > gridWidth || by + bh > gridHeight) continue;
      
      // Check overlap
      let overlap = false;
      for (const b of buildings) {
        if (bx < b.gx + b.gw && bx + bw > b.gx && by < b.gy + b.gh && by + bh > b.gy) {
          overlap = true; break;
        }
      }
      if (overlap) continue;
      
      const px = bx * blockSize;
      const py = by * blockSize;
      const pw = bw * blockSize;
      const ph = bh * blockSize;
      
      // Building color
      const bColors = dist.buildingColors;
      const color = bColors[Math.floor(cityRandom() * bColors.length)];
      const windowColor = dist.windowColor;
      
      // Floors and windows
      const floors = 2 + Math.floor(cityRandom() * (district === 0 ? 5 : 3));
      const windows = [];
      const winW = 8, winH = 10, winGap = 4;
      const winsPerFloor = Math.floor((pw - 16) / (winW + winGap));
      const winsPerSide = Math.floor((ph - 16) / (winH + winGap));
      
      for (let f = 0; f < floors; f++) {
        for (let wx = 0; wx < winsPerFloor; wx++) {
          for (let side = 0; side < 4; side++) {
            if (cityRandom() < 0.7) { // 70% lit windows
              let winX, winY;
              if (side === 0) { // top
                winX = px + 8 + wx * (winW + winGap);
                winY = py + 8 + f * (winH + 6);
              } else if (side === 1) { // right
                winX = px + pw - 8 - winW;
                winY = py + 8 + f * (winH + 6) + wx * (winH + winGap);
              } else if (side === 2) { // bottom
                winX = px + 8 + wx * (winW + winGap);
                winY = py + ph - 8 - winH - f * (winH + 6);
              } else { // left
                winX = px + 8;
                winY = py + 8 + f * (winH + 6) + wx * (winH + winGap);
              }
              windows.push({ x: winX, y: winY, w: winW, h: winH });
            }
          }
        }
      }
      
      buildings.push({
        gx: bx, gy: by, gw: bw, gh: bh,
        x: px, y: py, w: pw, h: ph,
        color, windowColor, floors, windows
      });
    }
  }
}

function generateParks() {
  parks.length = 0;
  
  for (let by = 0; by < gridHeight; by++) {
    for (let bx = 0; bx < gridWidth; bx++) {
      if (districtAt(bx, by) !== 4) continue; // only park district
      if (cityRandom() > 0.3) continue;
      
      const pw = 1 + Math.floor(cityRandom() * 2);
      const ph = 1 + Math.floor(cityRandom() * 2);
      if (bx + pw > gridWidth || by + ph > gridHeight) continue;
      
      parks.push({
        x: bx * blockSize, y: by * blockSize,
        w: pw * blockSize, h: ph * blockSize,
        type: Math.floor(cityRandom() * 3) // 0=grass, 1=trees, 2=mixed
      });
    }
  }
  
  // Central park guaranteed
  parks.push({ x: 38 * blockSize, y: 12 * blockSize, w: 7 * blockSize, h: 7 * blockSize, type: 2 });
}

function generateWater() {
  waterBodies.length = 0;
  
  // Ocean at edges
  for (let by = 0; by < gridHeight; by++) {
    for (let bx = 0; bx < gridWidth; bx++) {
      if (districtAt(bx, by) === 5) {
        waterBodies.push({
          x: bx * blockSize, y: by * blockSize,
          w: blockSize, h: blockSize,
          deep: (bx === 0 || bx === gridWidth - 1 || by === 0 || by === gridHeight - 1)
        });
      }
    }
  }
  
  // Merge adjacent water
  const merged = [];
  const visited = new Set();
  for (const w of waterBodies) {
    const key = `${w.x},${w.y}`;
    if (visited.has(key)) continue;
    let mx = w.x, my = w.y, mw = w.w, mh = w.h, mdeep = w.deep;
    visited.add(key);
    
    // Simple merge - just use individual for now
    merged.push({ x: w.x, y: w.y, w: w.w, h: w.h, deep: w.deep });
  }
  waterBodies.push(...merged);
}

function isRoadAt(worldX, worldY) {
  const bx = Math.floor(worldX / blockSize);
  const by = Math.floor(worldY / blockSize);
  
  // Check horizontal roads
  if (by > 0 && hRoads[by * gridWidth + bx] > 0) return true;
  if (by < gridHeight && hRoads[(by + 1) * gridWidth + bx] > 0) return true;
  // Check vertical roads
  if (bx > 0 && vRoads[bx * gridHeight + by] > 0) return true;
  if (bx < gridWidth && vRoads[(bx + 1) * gridHeight + by] > 0) return true;
  return false;
}

function getRoadTypeAt(worldX, worldY) {
  const bx = Math.floor(worldX / blockSize);
  const by = Math.floor(worldY / blockSize);
  let maxType = 0;
  
  if (by > 0) maxType = Math.max(maxType, hRoads[by * gridWidth + bx]);
  if (by < gridHeight) maxType = Math.max(maxType, hRoads[(by + 1) * gridWidth + bx]);
  if (bx > 0) maxType = Math.max(maxType, vRoads[bx * gridHeight + by]);
  if (bx < gridWidth) maxType = Math.max(maxType, vRoads[(bx + 1) * gridHeight + by]);
  return maxType;
}

function isSidewalkAt(worldX, worldY) {
  // Sidewalk is the edge of a road block
  const bx = Math.floor(worldX / blockSize);
  const by = Math.floor(worldY / blockSize);
  const inBlockX = (worldX % blockSize) / blockSize;
  const inBlockY = (worldY % blockSize) / blockSize;
  const margin = 0.08; // ~10px sidewalk
  
  // Check if near road edge
  const roadHere = isRoadAt(worldX, worldY);
  if (!roadHere) return false;
  
  // Check if at block edge
  return inBlockX < margin || inBlockX > 1 - margin || inBlockY < margin || inBlockY > 1 - margin;
}

function getDistrictAt(worldX, worldY) {
  const bx = Math.floor(worldX / blockSize);
  const by = Math.floor(worldY / blockSize);
  return districtAt(bx, by);
}

function getDistrictColor(worldX, worldY) {
  const d = getDistrictAt(worldX, worldY);
  const dist = DISTRICTS[Object.keys(DISTRICTS)[d]];
  return dist ? dist.color : '#2a2a3a';
}

function getGroundColor(worldX, worldY) {
  const d = getDistrictAt(worldX, worldY);
  const dist = DISTRICTS[Object.keys(DISTRICTS)[d]];
  if (!dist) return '#2a2a3a';
  
  if (d === 1) return dist.sandColor || dist.color; // beach sand
  if (d === 2) return dist.grassColor || dist.color; // suburbs grass
  if (d === 4) return dist.grassColor || dist.color; // park grass
  if (d === 5) return dist.deepColor || dist.color; // water
  return dist.color;
}

function initCity(seed = Date.now()) {
  cityRandomSeed(seed);
  generateDistricts();
  generateRoads();
  generateBuildings();
  generateParks();
  generateWater();
  
  return {
    worldWidth, worldHeight, blockSize, gridWidth, gridHeight,
    buildings, parks, waterBodies,
    districtMap, hRoads, vRoads,
    isRoadAt, getRoadTypeAt, isSidewalkAt, getDistrictAt, getDistrictColor, getGroundColor
  };
}

export { initCity, cityRandomSeed, cityRandom };
