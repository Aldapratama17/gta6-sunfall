// Sunfall City - Particle system
// Visual effects: smoke, sparks, blood, pickup effects, etc.

export function createParticleSystem() {
  const particles = [];
  const maxParticles = 500;
  
  function add(particle) {
    if (particles.length >= maxParticles) {
      particles.shift(); // Remove oldest
    }
    particles.push(particle);
  }
  
  function createSparks(x, y, angle) {
    const count = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const speed = 50 + Math.random() * 150;
      const lifetime = 0.3 + Math.random() * 0.4;
      add({
        type: 'spark',
        x, y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: 0, maxLife: lifetime,
        size: 1.5 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#ffaa00' : '#ff6600'
      });
    }
  }
  
  function createBlood(x, y, angle) {
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.0;
      const speed = 30 + Math.random() * 80;
      const lifetime = 0.5 + Math.random() * 0.8;
      add({
        type: 'blood',
        x, y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        life: 0, maxLife: lifetime,
        size: 2 + Math.random() * 3,
        color: '#8b0000'
      });
    }
  }
  
  function createSmoke(x, y, color = '#4a4a4a', count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 30;
      const lifetime = 0.8 + Math.random() * 1.2;
      add({
        type: 'smoke',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20, // Rise
        life: 0, maxLife: lifetime,
        size: 8 + Math.random() * 12,
        startSize: 8 + Math.random() * 12,
        color,
        alpha: 0.4 + Math.random() * 0.3
      });
    }
  }
  
  function createExhaust(x, y, angle, intensity = 1) {
    const count = Math.floor(3 * intensity);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.5;
      const speed = 20 + Math.random() * 40;
      const lifetime = 0.3 + Math.random() * 0.4;
      add({
        type: 'exhaust',
        x, y,
        vx: Math.cos(angle + Math.PI + spread) * speed,
        vy: Math.sin(angle + Math.PI + spread) * speed,
        life: 0, maxLife: lifetime,
        size: 4 + Math.random() * 6,
        color: '#2a2a2a',
        alpha: 0.3 + Math.random() * 0.2
      });
    }
  }
  
  function createPickupEffect(x, y, type) {
    const colors = {
      gun: '#ffaa00',
      health: '#4caf50',
      armor: '#2196f3'
    };
    const color = colors[type] || '#ffffff';
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 60 + Math.random() * 40;
      const lifetime = 0.5 + Math.random() * 0.3;
      add({
        type: 'pickup',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: lifetime,
        size: 3 + Math.random() * 3,
        color,
        alpha: 0.8
      });
    }
    
    // Ring
    add({
      type: 'ring',
      x, y,
      vx: 0, vy: 0,
      life: 0, maxLife: 0.4,
      size: 10,
      maxSize: 50,
      color,
      alpha: 0.5
    });
  }
  
  function createMuzzleFlash(x, y, angle) {
    // Flash
    add({
      type: 'muzzle',
      x, y,
      vx: 0, vy: 0,
      life: 0, maxLife: 0.06,
      size: 20,
      color: '#fff8c0',
      alpha: 1
    });
    
    // Smoke puff
    createSmoke(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15, '#3a3a3a', 4);
  }
  
  function createExplosion(x, y) {
    // Fireball
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 200;
      const lifetime = 0.5 + Math.random() * 0.5;
      add({
        type: 'fire',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: lifetime,
        size: 10 + Math.random() * 15,
        color: Math.random() < 0.5 ? '#ff6600' : '#ffcc00',
        alpha: 0.8
      });
    }
    
    // Smoke cloud
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      const lifetime = 1.5 + Math.random() * 1.5;
      add({
        type: 'smoke',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 10,
        life: 0, maxLife: lifetime,
        size: 20 + Math.random() * 30,
        color: '#1a1a1a',
        alpha: 0.5
      });
    }
    
    // Debris
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 150;
      const lifetime = 1.0 + Math.random() * 1.0;
      add({
        type: 'debris',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: lifetime,
        size: 3 + Math.random() * 5,
        color: '#3a3a3a',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }
  
  function createTireSmoke(x, y, color = '#6a6a6a') {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 15;
      const lifetime = 0.4 + Math.random() * 0.3;
      add({
        type: 'tireSmoke',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0, maxLife: lifetime,
        size: 6 + Math.random() * 8,
        color,
        alpha: 0.3
      });
    }
  }
  
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      
      // Physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Gravity for debris
      if (p.type === 'debris' || p.type === 'spark') {
        p.vy += 200 * dt;
      }
      
      // Drag for smoke
      if (p.type === 'smoke' || p.type === 'exhaust' || p.type === 'tireSmoke') {
        p.vx *= 0.98;
        p.vy *= 0.98;
      }
      
      // Rotation for debris
      if (p.rotSpeed) {
        p.rotation += p.rotSpeed * dt;
      }
      
      // Fade
      const lifeRatio = p.life / p.maxLife;
      if (p.type === 'ring') {
        p.size = p.size + (p.maxSize - p.size) * dt * 5;
        p.alpha = p.alpha * (1 - lifeRatio);
      } else if (p.type === 'muzzle') {
        p.alpha = 1 - lifeRatio;
        p.size = p.size * (1 - lifeRatio);
      } else {
        p.alpha = (p.alpha || 1) * (1 - lifeRatio);
      }
    }
  }
  
  function draw(ctx) {
    for (const p of particles) {
      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.max(0, p.alpha * (1 - lifeRatio));
      if (alpha <= 0) continue;
      
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      
      if (p.rotation) ctx.rotate(p.rotation);
      
      ctx.fillStyle = p.color;
      
      switch (p.type) {
        case 'spark':
        case 'blood':
        case 'pickup':
        case 'debris':
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'smoke':
        case 'exhaust':
        case 'tireSmoke':
        case 'fire':
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1 + lifeRatio * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'muzzle':
          // Cross shape
          ctx.fillRect(-p.size/2, -2, p.size, 4);
          ctx.fillRect(-2, -p.size/2, 4, p.size);
          break;
          
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
      
      ctx.restore();
    }
  }
  
  function clear() {
    particles.length = 0;
  }
  
  return {
    update,
    draw,
    clear,
    createSparks,
    createBlood,
    createSmoke,
    createExhaust,
    createPickupEffect,
    createMuzzleFlash,
    createExplosion,
    createTireSmoke
  };
}
