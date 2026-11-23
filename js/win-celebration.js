import { animate, easeOut } from './animation.js';
import { SIZE } from './settings.js';

export const FEATURED_WINS = {
  coin100: { title: 'BIG WIN', music: 'bigWin', coins: 42 },
  coin1000: { title: 'JACKPOT WIN!!!', music: 'jackpot', coins: 62 }
};
export const WIN_COUNT_MS = 10000;

export async function shakeCabinet(render, config, bell) {
  const slot = render.slot;
  const { x, y } = slot.position;
  const rotation = slot.rotation;
  const ticker = render.app.ticker;
  const synced = config.syncToBell && bell.audible;
  const duration = synced ? bell.duration * 1000 : config.duration;
  const start = performance.now();
  const draw = progress => {
    const wave = progress * duration / 1000 * config.frequency * 2 * Math.PI;
    const strength = (1 - progress) ** config.decay;
    slot.position.set(x + Math.sin(wave) * config.horizontal * strength,
      y + Math.sin(wave * .81) * config.vertical * strength);
    slot.rotation = rotation + Math.sin(wave * .68) * config.rotation * Math.PI / 180 * strength;
  };
  const syncFrame = () => draw(Math.min(1, (performance.now() - start) / Math.max(1, duration)));
  try {
    if (synced) {
      ticker.add(syncFrame, null, 50);
      await bell.done;
    } else if (duration > 0) {
      await animate(duration, draw, ticker);
    }
  } finally {
    ticker.remove(syncFrame);
    slot.position.set(x, y);
    slot.rotation = rotation;
  }
}

const rimColors = [
  0x644020, 0x8c5c29, 0xb78238, 0xe5b353, 0xffdd88,
  0xffeeae, 0xeaba5b, 0xb07a31, 0x855121, 0x603817
];
const rimArc = Array.from({ length: rimColors.length + 1 }, (_, index) => {
  const angle = Math.PI * (index / rimColors.length - .5);
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

function drawCoin(coin, yaw) {
  const cos = Math.cos(yaw);
  const faceWidth = Math.max(.003, Math.abs(cos));
  const offset = Math.sin(yaw) * (cos < 0 ? -1 : 1) * coin.thickness / 2;
  const direction = offset >= 0 ? -1 : 1;
  const { face, rim, halfWidth, halfHeight } = coin;
  face.scale.x = faceWidth;
  face.x = offset;
  face.tint = Math.round(222 + faceWidth * 33) * 0x010101;
  rim.clear();
  rim.visible = Math.abs(offset) >= .25;
  if (!rim.visible) return;
  const radius = direction * halfWidth * faceWidth;
  for (let index = 0; index < rimColors.length; index++) {
    const a = rimArc[index], b = rimArc[index + 1];
    const ax = a.x * radius, ay = a.y * halfHeight;
    const bx = b.x * radius, by = b.y * halfHeight;
    rim.beginFill(rimColors[index]).drawPolygon([
      ax + offset, ay, bx + offset, by, bx - offset, by, ax - offset, ay
    ]).endFill();
    if (index > 0) {
      rim.lineStyle(1.3, 0x73461b, .6).moveTo(ax + offset, ay).lineTo(ax - offset, ay);
      rim.lineStyle(0);
    }
  }
}

function coinFountain(root, texture, count) {
  const halfWidth = texture.width / 2;
  const halfHeight = texture.height / 2;
  const coins = Array.from({ length: count }, (_, index) => {
    const body = root.addChild(new PIXI.Container());
    const rim = body.addChild(new PIXI.Graphics());
    const face = body.addChild(new PIXI.Sprite(texture));
    face.anchor.set(.5);
    body.visible = false;
    const side = index % 2 ? 1 : -1;
    const life = .95 + Math.random() * .75;
    return {
      body, rim, face, halfWidth, halfHeight, thickness: halfWidth * .20,
      side, life, launch: index * .052,
      interval: life + .65 + Math.random() * .7,
      vx: side * (145 + Math.random() * 235), vy: -85 - Math.random() * 355,
      startX: side * (93 + Math.random() * 100),
      depth: .54 + Math.random() * .25, size: .20 + Math.random() * .36,
      spin: (3.1 + Math.random() * 5) * side, yaw: Math.random() * Math.PI * 2,
      roll: (Math.random() - .5) * .8
    };
  });
  return (time, cutoff) => {
    let flying = false;
    for (const coin of coins) {
      const { body, life, launch, interval, vx, vy, startX, depth, size, spin, yaw, roll } = coin;
      const age = (time - launch) % interval;
      body.visible = time >= launch && age < life && time - age < cutoff;
      if (!body.visible) continue;
      flying = true;
      const progress = age / life;
      const perspective = 1 / (1 - depth * progress);
      const x = startX + vx * age;
      const y = 54 + vy * age + 130 * age * age;
      body.position.set(SIZE / 2 + x * perspective, SIZE * .53 + y * perspective);
      body.rotation = roll + Math.sin(yaw + age * 2.3) * .5;
      body.scale.set(size * perspective);
      body.alpha = Math.min(1, age * 9, (1 - progress) * 5);
      body.zIndex = perspective;
      drawCoin(coin, yaw + age * spin);
    }
    return flying;
  };
}

export async function playWinCelebration(render, audio, node, id, amount, format) {
  const tier = FEATURED_WINS[id];
  const { stage, ticker } = render.app;
  const root = stage.addChild(new PIXI.Container());
  root.eventMode = 'none';
  root.sortableChildren = true;
  const shade = root.addChild(new PIXI.Graphics());
  shade.beginFill(0x080719, .83).drawRect(0, 0, SIZE, SIZE).endFill();
  const moveCoins = coinFountain(root, render.textures[id], render.mobile ? Math.ceil(tier.coins * .65) : tier.coins);
  const button = node.querySelector('button');
  const value = node.querySelector('#featured-win-amount');
  const announcement = node.querySelector('#featured-win-total');
  const previousFocus = document.activeElement;
  const start = performance.now();
  let phase = 'counting';
  let displayed = -1;
  let cutoff = WIN_COUNT_MS / 1000;
  let claim;
  let finishParticles;
  const claimed = new Promise(resolve => {
    claim = resolve;
  });
  const particlesDone = new Promise(resolve => {
    finishParticles = resolve;
  });
  function finishCount() {
    phase = 'ready';
    cutoff = Math.min(cutoff, (performance.now() - start) / 1000);
    value.textContent = format(amount);
    button.setAttribute('aria-label', 'Claim win');
    announcement.textContent = format(amount) + ' credits';
    audio.setMode('winHold');
  }
  function update() {
    const elapsed = performance.now() - start;
    if (!moveCoins(elapsed / 1000, cutoff) && phase !== 'counting') finishParticles();
    if (phase !== 'counting') return;
    if (elapsed >= WIN_COUNT_MS) finishCount();
    else {
      const progress = elapsed / WIN_COUNT_MS;
      const credits = Math.floor(amount * progress * (2 - progress));
      if (credits !== displayed) {
        displayed = credits;
        value.textContent = format(credits);
      }
    }
  }
  try {
    button.onclick = () => {
      if (phase === 'counting') finishCount();
      else if (phase === 'ready') {
        phase = 'claimed';
        button.disabled = true;
        claim();
      }
    };
    button.onkeydown = event => {
      if (event.repeat && (event.key === 'Enter' || event.code === 'Space')) event.preventDefault();
    };
    node.dataset.tier = tier.music;
    node.querySelector('#featured-win-title').textContent = tier.title;
    announcement.textContent = '';
    button.setAttribute('aria-label', 'Finish win count');
    value.textContent = format(0);
    button.disabled = false;
    node.hidden = false;
    button.focus({ preventScroll: true });
    audio.setMode(tier.music);
    ticker.add(update);
    await claimed;
    await Promise.all([
      animate(420, progress => {
        const alpha = 1 - easeOut(progress);
        node.style.opacity = alpha;
        shade.alpha = alpha;
      }, ticker),
      particlesDone
    ]);
  } finally {
    ticker.remove(update);
    root.destroy({ children: true });
    button.onclick = button.onkeydown = null;
    node.hidden = true;
    node.style.opacity = '';
    previousFocus?.focus({ preventScroll: true });
  }
}
