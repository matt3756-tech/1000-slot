// The soft texture and tapered rays are shared across all landing sparkles.
function sparkleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(48, 48, 0, 48, 48, 46);
  glow.addColorStop(0, 'rgba(255,255,255,.8)');
  glow.addColorStop(.17, 'rgba(255,255,255,.36)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 96, 96);
  const ray = context.createRadialGradient(48, 48, 1, 48, 48, 46);
  ray.addColorStop(0, '#fff');
  ray.addColorStop(.3, 'rgba(255,255,255,.9)');
  ray.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = ray;
  context.beginPath();
  [[48, 1], [53, 42], [92, 48], [53, 53], [48, 95], [42, 53], [4, 48], [42, 42]]
    .forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.fill();
  return PIXI.Texture.from(canvas);
}

const tint = value => Number.parseInt(value.slice(1), 16);

export class CoinEffects {
  constructor(render) {
    this.render = render;
    this.root = new PIXI.Container();
    this.root.eventMode = 'none';
    render.slot.addChild(this.root);
    this.texture = sparkleTexture();
    this.states = Array(3).fill(null);
  }

  clear() {
    for (let reel = 0; reel < 3; reel++) this.clearReel(reel);
  }

  clearReel(reel) {
    const state = this.states[reel];
    if (!state) return;
    state.root.destroy({ children: true });
    this.states[reel] = null;
  }

  start(reel, cell, kind) {
    const cfg = this.render.settings[kind];
    if (cell.id === 'blank' || !cfg.enabled || !cfg.duration) return;
    this.clearReel(reel);
    const root = new PIXI.Container();
    const tx = this.render.textures[cell.id];
    const outer = new PIXI.Sprite(tx);
    const face = new PIXI.Sprite(tx);
    for (const sprite of [outer, face]) {
      sprite.anchor.set(.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
    }
    const blur = new PIXI.BlurFilter(Math.max(1, cfg.haloBlur), 2);
    const filter = new PIXI.ColorMatrixFilter();
    const color = tint(cfg.haloTint);
    filter.matrix = [
      0, 0, 0, 0, ((color >>> 16) & 255) / 255,
      0, 0, 0, 0, ((color >>> 8) & 255) / 255,
      0, 0, 0, 0, (color & 255) / 255,
      0, 0, 0, 1, 0
    ];
    outer.filters = [blur, filter];
    root.addChild(outer, face);
    const sparkles = Array.from({ length: cfg.sparkles ? Math.round(cfg.sparkleCount) : 0 }, () => {
      const angle = Math.random() * Math.PI * 2, radius = .18 + Math.sqrt(Math.random()) * .76;
      const sprite = new PIXI.Sprite(this.texture);
      sprite.anchor.set(.5);
      sprite.blendMode = PIXI.BLEND_MODES.ADD;
      sprite.tint = tint(cfg.sparkleColor);
      root.addChild(sprite);
      return { sprite, angle, radius, turn: Math.random() * Math.PI, start: Math.random() * .55,
        span: .22 + Math.random() * .30, size: .35 + Math.random() * .75 };
    });
    this.root.addChild(root);
    this.states[reel] = { root, outer, face, sparkles, kind, born: performance.now() };
  }

  progress(reel, now) {
    const state = this.states[reel];
    if (!state) return null;
    const cfg = this.render.settings[state.kind];
    const p = (now - state.born) / Math.max(1, cfg.duration);
    if (p >= 1 || !cfg.enabled) {
      this.clearReel(reel);
      return null;
    }
    const envelope = Math.min(1, p * 9) * (1 - p ** 1.65);
    return { state, cfg, p, envelope };
  }

  update(reel, pose, current, opening) {
    if (!current || !pose.visible) return;
    const { state, cfg, p, envelope } = current;
    const { root, outer, face } = state;
    root.position.set(opening.x + pose.x, opening.y + pose.y);
    root.rotation = pose.rotation;
    outer.scale.set(pose.scale.x * 1.05, pose.scale.y * 1.05);
    outer.alpha = cfg.haloAlpha * envelope * pose.alpha;
    face.scale.copyFrom(pose.scale);
    face.alpha = cfg.brightness * envelope * pose.alpha;
    face.tint = pose.tint;
    for (const point of state.sparkles) {
      const t = (p - point.start) / point.span;
      const pulse = t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 2 : 0;
      const { sprite } = point;
      sprite.visible = pulse > .006 && cfg.sparkles;
      if (!sprite.visible) continue;
      sprite.x = Math.cos(point.angle) * point.radius * pose.width * .49;
      sprite.y = Math.sin(point.angle) * point.radius * pose.height * .49;
      sprite.rotation = point.turn + t * .43;
      sprite.alpha = cfg.sparkleAlpha * pulse;
      sprite.width = sprite.height = cfg.sparkleSize * point.size * (.38 + pulse * .62);
    }
  }
}
