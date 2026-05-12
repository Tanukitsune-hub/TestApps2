const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  wave: document.getElementById('wave'),
  lives: document.getElementById('lives'),
  gold: document.getElementById('gold'),
  hint: document.getElementById('hint'),
  startWaveBtn: document.getElementById('startWaveBtn'),
};

const towerDefs = {
  ruby: { cost: 50, range: 90, fireRate: 0.55, dmg: 18, color: '#ff4d57' },
  sapphire: { cost: 60, range: 130, fireRate: 0.85, dmg: 12, color: '#56b4ff' },
  emerald: { cost: 70, range: 75, fireRate: 0.35, dmg: 26, color: '#50e484' },
};

const state = {
  wave: 1,
  lives: 20,
  gold: 120,
  selectedTower: null,
  towers: [],
  enemies: [],
  projectiles: [],
  spawning: false,
  spawnLeft: 0,
  spawnCooldown: 0,
};

const path = [
  { x: 0, y: 240 },
  { x: 180, y: 240 },
  { x: 180, y: 110 },
  { x: 420, y: 110 },
  { x: 420, y: 360 },
  { x: 660, y: 360 },
  { x: 660, y: 210 },
  { x: 900, y: 210 },
];

const slots = [
  { x: 100, y: 140 }, { x: 100, y: 330 }, { x: 260, y: 180 },
  { x: 310, y: 300 }, { x: 520, y: 70 }, { x: 540, y: 250 },
  { x: 760, y: 300 }, { x: 760, y: 100 }, { x: 360, y: 420 },
];

function setupUI() {
  document.querySelectorAll('[data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-type]').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedTower = btn.dataset.type;
      ui.hint.textContent = `${btn.textContent} を配置する場所をクリック`;
    });
  });

  ui.startWaveBtn.addEventListener('click', startWave);

  canvas.addEventListener('click', (e) => {
    if (!state.selectedTower) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const slot = slots.find((s) => Math.hypot(s.x - x, s.y - y) < 26);
    if (!slot) return;
    if (state.towers.some((t) => t.slot === slot)) return;

    const def = towerDefs[state.selectedTower];
    if (state.gold < def.cost) {
      ui.hint.textContent = 'エネルギー不足！';
      return;
    }

    state.gold -= def.cost;
    state.towers.push({ ...def, x: slot.x, y: slot.y, cooldown: 0, slot });
    updateHUD();
  });
}

function startWave() {
  if (state.spawning || state.lives <= 0) return;
  state.spawning = true;
  state.spawnLeft = 8 + state.wave * 2;
  state.spawnCooldown = 0;
}

function spawnEnemy() {
  const hp = 45 + state.wave * 12;
  state.enemies.push({
    x: path[0].x,
    y: path[0].y,
    hp,
    maxHp: hp,
    speed: 40 + state.wave * 3,
    segment: 0,
  });
}

function update(dt) {
  if (state.spawning) {
    state.spawnCooldown -= dt;
    if (state.spawnLeft > 0 && state.spawnCooldown <= 0) {
      spawnEnemy();
      state.spawnLeft -= 1;
      state.spawnCooldown = 0.7;
    }
    if (state.spawnLeft === 0 && state.enemies.length === 0) {
      state.spawning = false;
      state.wave += 1;
      state.gold += 35;
      updateHUD();
    }
  }

  for (const enemy of state.enemies) {
    const next = path[enemy.segment + 1];
    if (!next) {
      enemy.reached = true;
      state.lives -= 1;
      continue;
    }
    const dx = next.x - enemy.x;
    const dy = next.y - enemy.y;
    const d = Math.hypot(dx, dy);
    const move = enemy.speed * dt;

    if (move >= d) {
      enemy.x = next.x;
      enemy.y = next.y;
      enemy.segment += 1;
    } else {
      enemy.x += (dx / d) * move;
      enemy.y += (dy / d) * move;
    }
  }

  for (const tower of state.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    const target = state.enemies.find((e) => !e.reached && Math.hypot(e.x - tower.x, e.y - tower.y) <= tower.range);
    if (target) {
      state.projectiles.push({
        x: tower.x,
        y: tower.y,
        tx: target,
        speed: 320,
        dmg: tower.dmg,
        color: tower.color,
      });
      tower.cooldown = tower.fireRate;
    }
  }

  for (const p of state.projectiles) {
    if (!p.tx || p.tx.reached || p.tx.hp <= 0) {
      p.dead = true;
      continue;
    }
    const dx = p.tx.x - p.x;
    const dy = p.tx.y - p.y;
    const d = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (move >= d) {
      p.tx.hp -= p.dmg;
      p.dead = true;
      if (p.tx.hp <= 0) {
        p.tx.dead = true;
        state.gold += 12;
      }
    } else {
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
    }
  }

  state.enemies = state.enemies.filter((e) => !e.dead && !e.reached);
  state.projectiles = state.projectiles.filter((p) => !p.dead);
  if (state.lives <= 0) {
    state.spawning = false;
  }
  updateHUD();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 28;
  ctx.strokeStyle = '#2f2447';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();

  slots.forEach((s) => {
    ctx.fillStyle = '#243261';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
    ctx.fill();
  });

  state.towers.forEach((t) => {
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
    ctx.fill();
  });

  state.enemies.forEach((e) => {
    ctx.fillStyle = '#201318';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c62f56';
    ctx.fillRect(e.x - 16, e.y - 20, 32, 4);
    ctx.fillStyle = '#6eff9e';
    ctx.fillRect(e.x - 16, e.y - 20, 32 * (e.hp / e.maxHp), 4);
  });

  state.projectiles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (state.lives <= 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('GAME OVER', 300, 250);
  }
}

function updateHUD() {
  ui.wave.textContent = state.wave;
  ui.lives.textContent = Math.max(0, state.lives);
  ui.gold.textContent = state.gold;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

setupUI();
updateHUD();
requestAnimationFrame(loop);
