import { mobileProfile, renderProfile } from './mobile.js';
import { EditorGrid, snapPoint } from './editor-grid.js';
import { AnticipationChase } from './anticipation-chase.js';
import { CoinEffects } from './effects.js';
import { mediaSource } from './assets.js';
import { BLANK, COINS } from './math.js';
import { FONT, SIZE, getPath, updateLayoutField } from './settings.js';
import { cell } from './outcomes.js';

export const color = value => Number.parseInt(value.replace('#', ''), 16);
export const BUTTON_IDS = ['menu', 'spin', 'betMinus', 'betPlus'];
export let textQuality = { resolution: 2, roundPixels: false };
export function text(label, size = 32, fill = '#ffffff') {
  const node = new PIXI.Text(label, { fontFamily: FONT, fontSize: size, fontWeight: 'normal', fill, align: 'center' });
  node.anchor.set(.5);
  Object.assign(node, textQuality);
  return node;
}

const sprite = (texture = PIXI.Texture.EMPTY) => {
  const node = new PIXI.Sprite(texture);
  node.anchor.set(.5);
  return node;
};

export class Renderer {
  constructor(settings) {
    this.settings = settings;
    this.mobile = mobileProfile(settings);
    const profile = renderProfile(settings, this.mobile);
    this.app = new PIXI.Application({
      width: SIZE, height: SIZE, antialias: !this.mobile, backgroundAlpha: 0,
      resolution: profile.resolution, autoDensity: false, powerPreference: 'high-performance'
    });
    document.querySelector('#stage').append(this.app.view);
    this.app.view.setAttribute('aria-label', 'Coin 10s three-reel slot');
    this.slot = new PIXI.Container();
    this.app.stage.addChild(this.slot);
    this.textures = {};
    this.peeks = [];
    this.layoutParents = {};
    this.targets = {};
    this.editMode = false;
  }

  async load() {
    const images = { frame: 'assets/cabinet.png',
      ...Object.fromEntries(COINS.map(id => [id, 'assets/coins/' + id + '.png'])),
      ...Object.fromEntries(BUTTON_IDS.map(id => ['button:' + id, 'assets/button-' + id + '.png']))
    };
    this.urls = Object.fromEntries(Object.entries(images).map(([id, path]) => [id, mediaSource(path)]));
    await Promise.all(Object.entries(this.urls).map(async ([id, url]) => {
      this.textures[id] = await PIXI.Assets.load(url);
    }));
    this.frame = sprite(this.textures.frame);
    this.slot.addChild(this.frame);
    this.registerDrag('slot', this.frame);
    this.reels = Array.from({ length: 3 }, () => {
      // ZEUS1's masked, pooled moving and landed reel layers.
      const root = new PIXI.Container(), mask = new PIXI.Graphics();
      const moving = new PIXI.Container(), fixed = new PIXI.Container();
      const sprites = Array.from({ length: 9 }, () => moving.addChild(sprite()));
      const statics = Array.from({ length: 9 }, () => fixed.addChild(sprite()));
      root.addChild(mask, moving, fixed);
      root.mask = mask;
      this.slot.addChild(root);
      return { root, mask, moving, fixed, sprites, statics, pose: null };
    });
    this.effects = new CoinEffects(this);
    this.chase = new AnticipationChase(this);
    this.editorGrid = new EditorGrid(this);
    this.selection = this.app.stage.addChild(new PIXI.Graphics());
    this.selection.eventMode = 'none';
    this.app.ticker.add(() => {
      this.updateLandingVisuals();
      this.chase.update();
    });
    this.apply();
  }

  opening(reel) {
    const cfg = this.geometry;
    return { x: cfg.x - SIZE / 2 + cfg.columnStep * reel, y: cfg.y - SIZE / 2, w: cfg.w, h: cfg.h };
  }

  resizeQuality() {
    const next = mobileProfile(this.settings);
    const profile = renderProfile(this.settings, next);
    this.mobile = next;
    this.app.ticker.maxFPS = profile.maxFPS;
    if (this.app.renderer.resolution !== profile.resolution) {
      this.app.renderer.resolution = profile.resolution;
      this.app.renderer.resize(SIZE, SIZE);
    }
    textQuality = { roundPixels: this.settings.textRendering.roundPixels, resolution: profile.textResolution };
    this.textQuality = textQuality;
    const walk = node => {
      if (node instanceof PIXI.Text) Object.assign(node, textQuality);
      node.children?.forEach(walk);
    };
    walk(this.app.stage);
  }

  apply() {
    const s = this.settings;
    // Freeze strip coordinates while an animation is in flight.
    if (!this.motions) this.geometry = { ...s.reels, spacing: Math.max(s.reels.spacing, s.reels.h / 5) };
    this.slot.position.set(s.slot.x, s.slot.y);
    this.slot.scale.set(s.slot.scale);
    this.slot.rotation = s.slot.rotation * Math.PI / 180;
    this.slot.alpha = s.slot.alpha;
    document.documentElement.style.setProperty('--bg-brightness', s.background.brightness);
    this.resizeQuality();
    this.editorGrid?.apply();
    this.reels?.forEach((view, reel) => {
      const opening = this.opening(reel);
      view.root.position.set(opening.x, opening.y);
      view.mask.clear().beginFill(0xffffff)
        .drawRoundedRect(0, 0, opening.w, opening.h, this.geometry.clipRadius).endFill();
    });
    this.updateLandingVisuals();
  }

  symbol(node, cell, reel, y, pulse = 0) {
    const settings = this.settings.symbols[cell?.id];
    node.visible = Boolean(settings);
    if (!settings) return;
    const texture = this.textures[cell.id];
    if (node.texture !== texture) node.texture = texture;
    const fit = settings.size / Math.max(texture.width, texture.height) * (1 + pulse);
    node.scale.set(fit * settings.widthScale, fit * settings.heightScale);
    node.position.set(this.opening(reel).w / 2 + settings.offsetX, y + settings.offsetY);
    node.rotation = settings.rotation * Math.PI / 180;
    node.alpha = settings.alpha;
    node.tint = color(settings.tint);
  }

  beginSpin(motions) {
    this.motions = motions;
    this.effects.clear();
    this.reels.forEach((view, reel) => {
      view.pose = null;
      view.moving.visible = true;
      view.fixed.visible = false;
      this.spinFrame(reel, 0, motions[reel]);
    });
  }

  spinFrame(reel, distance, motion) {
    const { spacing, h } = this.geometry;
    const first = Math.floor(-distance / spacing) - 3;
    this.reels[reel].sprites.forEach((node, index) => {
      const row = first + index;
      this.symbol(node, motion.strip[row], reel, h / 2 + (row - 1) * spacing + distance);
    });
  }

  landReel(reel, column, peeks, offset = 0) {
    const view = this.reels[reel];
    view.moving.visible = false;
    view.fixed.visible = true;
    view.pose = { column, peeks, offset };
    this.drawStaticReel(reel, performance.now());
  }

  drawStaticReel(reel, now) {
    const view = this.reels[reel];
    if (!view.pose) return;
    const { column, peeks, offset } = view.pose;
    const { spacing, h } = this.geometry;
    const current = this.effects.progress(reel, now);
    const pulse = current ? current.cfg.pop * current.envelope : 0;
    view.statics.forEach((node, index) => {
      const row = index - 3;
      const item = row >= 0 && row <= 2 ? column[row] :
        row === -1 ? peeks.top : row === 3 ? peeks.bottom : peeks.extra?.[row];
      this.symbol(node, item, reel, h / 2 + (row - 1) * spacing + offset, row === 1 ? pulse : 0);
      if (row === 1) this.effects.update(reel, node, current, this.opening(reel));
    });
  }

  startLanding(reel, cell) {
    this.effects.start(reel, cell, 'landing');
  }

  updateLandingVisuals() {
    const now = performance.now();
    this.reels?.forEach((view, reel) => {
      if (view.pose && view.fixed.visible) this.drawStaticReel(reel, now);
    });
  }

  endSpin(board, peeks = this.peeks) {
    this.board = board;
    this.peeks = peeks;
    this.motions = null;
    this.reels.forEach((view, reel) => {
      const next = board[reel][1].id === BLANK ? board[reel][0] : cell();
      const near = board[reel][1].id === BLANK ? cell() : board[reel][1];
      this.landReel(reel, board[reel], peeks[reel] ?? { top: near, bottom: near, extra: { '-2': next, '4': next } });
    });
    this.apply();
  }

  setAnticipation(reels) {
    this.chase.set(reels);
  }

  registerDrag(path, target, parent = null, enabled = () => true) {
    this.targets[path] = target;
    if (parent) this.layoutParents[path] = parent;
    target.eventMode = 'static';
    target.on('pointerdown', event => {
      if (this.editMode && enabled()) this.startDrag(path, event);
    });
  }

  startDrag(path, event) {
    if (event.button > 0 || this.motions) return;
    event.stopPropagation();
    this.select?.(path);
    const cfg = getPath(this.settings, path);
    if (typeof cfg.x !== 'number' || typeof cfg.y !== 'number') return;
    const parent = this.layoutParents[path];
    const start = parent ? parent.toLocal(event.global) : event.global;
    const x = cfg.x, y = cfg.y;
    const stage = this.app.stage;
    this.onDragStart?.();
    const move = ev => {
      const point = parent ? parent.toLocal(ev.global) : ev.global;
      const snapped = snapPoint({ x: x + point.x - start.x, y: y + point.y - start.y }, this.settings.editorGrid, parent);
      updateLayoutField(this.settings, path + '.x', snapped.x);
      updateLayoutField(this.settings, path + '.y', snapped.y);
      this.onDrag?.(path);
    };
    const end = () => {
      stage.off('globalpointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    stage.eventMode = 'static';
    stage.hitArea = new PIXI.Rectangle(0, 0, SIZE, SIZE);
    stage.on('globalpointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  highlight(path) {
    this.selection.clear();
    const target = this.targets[path];
    if (!this.editMode || !target?.visible || path.startsWith('masks.')) return;
    const box = target.getBounds();
    this.selection.lineStyle(2, 0x6ee4ff, .9).drawRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
  }
}
