import { animate } from './animation.js';
import { BUTTON_IDS, color, text } from './rendering.js';

export const buttonShape = (graphic, config) => graphic.drawRoundedRect(
  -config.w / 2, -config.h / 2, config.w, config.h,
  Math.min(config.radius ?? (config.round ? Math.min(config.w, config.h) / 2 : config.h * .46), config.h / 2, config.w / 2)
);

function labelPosition(node, string, size, fill, x, y, maxWidth) {
  node.text = string;
  node.style.fontSize = size;
  node.style.fill = fill;
  node.position.set(x, y);
  node.scale.set(1);
  node.scale.set(Math.min(1, maxWidth / Math.max(1, node.width)));
}

function position(node, config) {
  node.position.set(config.x, config.y);
  node.scale.set(config.scale ?? 1);
  node.rotation = (config.rotation ?? 0) * Math.PI / 180;
  node.alpha = config.alpha ?? 1;
}

const makeSprite = texture => {
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(.5);
  return sprite;
};

export class Controls {
  constructor(render, settings, onAction) {
    this.render = render;
    this.settings = settings;
    this.root = render.slot.addChild(new PIXI.Container());
    this.root.eventMode = 'passive';
    this.buttons = {};
    this.hud = {};
    this.gridMasks = {};
    for (const id of BUTTON_IDS) {
      const texture = render.textures['button:' + id];
      const root = this.root.addChild(new PIXI.Container());
      const image = makeSprite(texture), label = text('');
      root.addChild(image, label);
      const pressRoot = this.root.addChild(new PIXI.Container());
      pressRoot.eventMode = 'none';
      const moving = pressRoot.addChild(new PIXI.Container());
      const mask = pressRoot.addChild(new PIXI.Graphics());
      const cover = moving.addChild(new PIXI.Graphics());
      const pressedImage = moving.addChild(makeSprite(texture));
      const pressedLabel = moving.addChild(text(''));
      pressedImage.blendMode = PIXI.BLEND_MODES.NORMAL;
      pressRoot.mask = mask;
      pressRoot.visible = false;
      this.buttons[id] = { root, image, label, pressRoot, moving, mask, cover, pressedImage, pressedLabel, progress: 0 };
      render.registerDrag('buttons.' + id, root, this.root);
      root.cursor = 'pointer';
      root.on('pointertap', () => {
        if (!render.editMode && root.cursor === 'pointer') onAction(id);
      });
    }
    for (const id of ['credit', 'bet', 'win']) {
      const root = this.root.addChild(new PIXI.Container());
      const label = root.addChild(text('')), number = root.addChild(text(''));
      this.hud[id] = { root, label, number };
      render.registerDrag('hud.' + id, root, this.root);
    }
    this.badges = [-1, 1].map(() => {
      const root = this.root.addChild(new PIXI.Container());
      return { root, number: root.addChild(text('1')), text: root.addChild(text('PAYLINE')) };
    });
    const overlays = render.slot.addChild(new PIXI.Container());
    overlays.eventMode = 'passive';
    for (const id of BUTTON_IDS) {
      const outline = overlays.addChild(new PIXI.Graphics());
      this.gridMasks[id] = outline;
      render.registerDrag('masks.' + id, outline, overlays);
      outline.cursor = 'move';
    }
  }

  apply() {
    const s = this.settings;
    for (const [id, button] of Object.entries(this.buttons)) {
      const cfg = s.buttons[id], pressMask = s.masks[id];
      position(button.root, cfg);
      button.root.cursor = this.render.editMode ? 'move' : 'pointer';
      button.root.hitArea = cfg.round
        ? new PIXI.Ellipse(0, 0, cfg.w / 2 + cfg.hitPadding, cfg.h / 2 + cfg.hitPadding)
        : new PIXI.RoundedRectangle(-cfg.w / 2 - cfg.hitPadding, -cfg.h / 2 - cfg.hitPadding, cfg.w + cfg.hitPadding * 2, cfg.h + cfg.hitPadding * 2, cfg.h / 2);
      for (const image of [button.image, button.pressedImage]) {
        image.width = cfg.w;
        image.height = cfg.h;
      }
      for (const label of [button.label, button.pressedLabel]) {
        labelPosition(label, cfg.label, cfg.fontSize, cfg.color, cfg.labelX, cfg.labelY, cfg.w * .67);
      }
      const covered = cfg.pressShade;
      const shade = '#'+((Math.round(255 * (1 - covered)) * 0x010101).toString(16).padStart(6, '0'));
      button.cover.clear();
      buttonShape(button.cover.beginFill(0x080c14), cfg).endFill();
      button.pressedImage.tint = color(shade);
      position(button.mask, pressMask);
      buttonShape(button.mask.clear().beginFill(0xffffff), pressMask).endFill();
      const outline = this.gridMasks[id];
      const selected = this.render.editorPath === 'masks.' + id || this.render.editorPath === 'buttons.' + id;
      outline.visible = this.render.editMode && pressMask.show;
      position(outline, pressMask);
      outline.clear().lineStyle(selected ? 3 : 1.5, selected ? 0x75ebff : 0x74b9cb, selected ? .97 : .63);
      buttonShape(outline.beginFill(0x759bc3, selected ? .12 : .045), pressMask).endFill();
      const { w, h, radius } = pressMask;
      const outer = new PIXI.RoundedRectangle(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, radius + 6);
      const inner = new PIXI.RoundedRectangle(-w / 2 + 8, -h / 2 + 8, Math.max(0, w - 16), Math.max(0, h - 16), Math.max(0,radius - 8));
      const fullMask = this.render.editorPath === 'masks.' + id;
      outline.hitArea = { contains: (x, y) => outer.contains(x, y) && (fullMask || !inner.contains(x, y)) };
      this.drawPress(id);
    }
    const badge = s.payline;
    this.badges.forEach(({ root, number, text }, index) => {
      root.position.set(badge.x + (index ? 1 : -1) * badge.spacing / 2, badge.y);
      root.visible = badge.enabled;
      root.alpha = badge.alpha;
      labelPosition(number, '1', badge.labelSize, badge.color, 0, -11, 30);
      labelPosition(text, 'PAYLINE', badge.subSize, badge.color, 0, 14, 53);
    });
    if (this.player) this.update(this.player, this.busy);
  }

  update(player, busy) {
    this.player = player;
    this.busy = busy;
    const values = { credit: player.credits, bet: player.bet, win: player.lastWin };
    for (const [id, nodes] of Object.entries(this.hud)) {
      const cfg = this.settings.hud[id];
      position(nodes.root, cfg);
      labelPosition(nodes.label, cfg.label, cfg.labelSize, cfg.labelColor, 0, cfg.labelY, cfg.w);
      labelPosition(nodes.number, values[id].toLocaleString('en-US'), cfg.fontSize, cfg.color, 0, 0, cfg.w);
    }
    for (const [id, button] of Object.entries(this.buttons)) {
      button.root.cursor = this.render.editMode ? 'move' : busy ? 'default' : 'pointer';
    }
  }

  drawPress(id) {
    const button = this.buttons[id], cfg = this.settings.buttons[id];
    const progress = button.progress;
    button.pressRoot.visible = progress > .001;
    button.pressRoot.alpha = cfg.alpha * Math.min(1, progress * 5);
    button.moving.position.set(cfg.x, cfg.y + cfg.pressY * progress);
    button.moving.rotation = cfg.rotation * Math.PI / 180;
    button.moving.scale.set(cfg.scale * (1 - (1 - cfg.pressScale) * progress));
    // The button-shaped cover stays anchored to the original footprint.
    button.cover.position.y = -cfg.pressY * progress / cfg.scale;
    button.cover.scale.set(1 / Math.max(.1, 1 - (1 - cfg.pressScale) * progress));
  }

  press(id) {
    const button = this.buttons[id], token = Symbol();
    button.token = token;
    animate(this.settings.buttons[id].pressDuration, progress => {
      if (button.token !== token) return;
      button.progress = Math.sin(Math.PI * progress);
      this.drawPress(id);
    }, this.render.app.ticker);
  }
}
