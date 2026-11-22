const puppeteer = require('/root/makefun/node_modules/puppeteer');

const CHROME_PATH = '/root/.cache/puppeteer/chrome/linux-157.0.8103.78/chrome-linux64/chrome';

async function takeScreenshot(page, filename) {
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  const fs = require('fs');
  fs.writeFileSync(filename, buffer);
  const stats = fs.statSync(filename);
  console.log(`Saved ${filename}: ${stats.size} bytes`);
  
  // If >200KB, re-encode as JPEG q90
  if (stats.size > 200000) {
    const sharp = require('sharp');
    await sharp(filename).jpeg({ quality: 90 }).toFile(filename.replace('.png', '.jpg'));
    fs.unlinkSync(filename);
    const newStats = fs.statSync(filename.replace('.png', '.jpg'));
    console.log(`Re-encoded to JPEG: ${newStats.size} bytes`);
  }
}

async function hasNonBlackPixels(page) {
  return await page.evaluate(() => {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10 || data[i+1] > 10 || data[i+2] > 10) {
        return true;
      }
    }
    return false;
  });
}

async function waitForGameReady(page) {
  // Wait for canvas to be properly sized
  await page.waitForFunction(() => {
    const canvas = document.getElementById('game');
    return canvas.width > 300 && canvas.height > 150;
  }, { timeout: 10000 });
  
  // Wait a bit more for game to render
  await new Promise(r => setTimeout(r, 2000));
  
  // Check for non-black pixels
  const hasPixels = await hasNonBlackPixels(page);
  if (!hasPixels) {
    throw new Error('Canvas is all black - game not rendering');
  }
  console.log('Game canvas verified: proper size and non-black pixels');
}

async function logConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  return errors;
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('PAGE ERROR:', err.message);
  });
  
  console.log('Loading game...');
  await page.goto('http://localhost:8831/', { waitUntil: 'networkidle0' });
  
  console.log('Waiting for game to be ready...');
  await waitForGameReady(page);
  
  // Dismiss start menu - press Enter or Space per ui.js
  console.log('Dismissing start menu...');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 1500));
  
  // Shot 1: On-foot downtown with HUD
  console.log('Taking shot 1: on-foot downtown...');
  await takeScreenshot(page, '/root/makefun/gta6-sunfall/screenshots/01-city.png');
  
  // Shot 2: Inside a car driving (E to enter near vehicle, then steer)
  console.log('Entering vehicle...');
  await page.keyboard.press('KeyE');
  await new Promise(r => setTimeout(r, 1500));
  
  console.log('Driving...');
  await page.keyboard.down('KeyW'); // Accelerate
  await new Promise(r => setTimeout(r, 2000));
  await page.keyboard.up('KeyW');
  
  console.log('Taking shot 2: driving...');
  await takeScreenshot(page, '/root/makefun/gta6-sunfall/screenshots/02-driving.png');
  
  // Shot 3: Police chase (raise wanted: attack a ped or cop, wait for 2+ stars)
  console.log('Starting police chase...');
  await page.keyboard.press('Space'); // Attack/shoot
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.press('Space');
  await new Promise(r => setTimeout(r, 3000)); // Wait for wanted level to rise
  
  console.log('Taking shot 3: police chase...');
  await takeScreenshot(page, '/root/makefun/gta6-sunfall/screenshots/03-chase.png');
  
  // Shot 4: Mission dialogue/objective
  console.log('Triggering mission...');
  // Use debug API to trigger mission
  await page.evaluate(() => {
    if (window.SunfallCity && window.SunfallCity.missions) {
      window.SunfallCity.missions.startMission('delivery');
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Taking shot 4: mission...');
  await takeScreenshot(page, '/root/makefun/gta6-sunfall/screenshots/04-mission.png');
  
  await browser.close();
  
  console.log('\nConsole errors captured:');
  for (const e of errors) {
    console.log('  -', e);
  }
  
  if (errors.length > 0) {
    console.log('\nWARNING: Console errors found!');
  } else {
    console.log('\nNo console errors!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
