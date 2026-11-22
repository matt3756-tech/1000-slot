import { FONT, SIZE } from './settings.js';

// ZEUS1's load-then-gesture startup, fitted to the square cabinet.
export class Startup {
  constructor(settings) {
    this.s = settings;
    this.el = document.querySelector('#boot');
    this.scene = document.querySelector('#boot-scene');
    this.title = document.querySelector('#boot-title');
    this.image = document.querySelector('#boot-coins');
    this.status = document.querySelector('#boot-status');
    this.prompt = document.querySelector('#start');
    this.resize = () => this.apply();
    window.addEventListener('resize', this.resize);
  }

  apply() {
    const cfg = this.s.startup, area = this.el.getBoundingClientRect();
    const fit = Math.min(area.width / SIZE, area.height / SIZE);
    this.scene.style.transform = `translate(-50%, -50%) scale(${fit})`;
    this.title.textContent = cfg.title;
    Object.assign(this.title.style, { left: cfg.x + 'px', top: cfg.y + 'px', color: cfg.color, fontSize: cfg.titleSize + 'px' });
    Object.assign(this.image.style, { left: cfg.x + 'px', top: cfg.y + cfg.h * .87 + 'px',
      width: cfg.w * cfg.scale + 'px', height: cfg.h * cfg.scale + 'px', opacity: cfg.imageAlpha });
    for (const node of [this.status, this.prompt]) {
      node.style.fontFamily = FONT;
      node.style.fontSize = cfg.fontSize + 'px';
    }
    this.status.style.top = cfg.loadingY + 'px';
    this.prompt.style.top = cfg.promptY + 'px';
    this.el.style.transitionDuration = cfg.fadeDuration + 'ms';
  }

  progress(message) { this.status.textContent = message; }

  ready(action) {
    this.progress('');
    this.prompt.hidden = false;
    this.el.addEventListener('click', action, { once: true });
  }

  close() {
    this.el.classList.add('boot-fade');
    this.el.inert = true;
    setTimeout(() => { if (this.el.classList.contains('boot-fade')) this.el.hidden = true; }, this.s.startup.fadeDuration);
  }

  preview() {
    this.el.hidden = false;
    this.el.inert = true;
    this.el.classList.remove('boot-fade');
    this.el.classList.add('boot-preview');
    this.apply();
  }

  hidePreview() {
    if (!this.el.classList.contains('boot-preview')) return;
    this.el.classList.remove('boot-preview');
    this.el.classList.add('boot-fade');
    this.el.hidden = true;
  }
}
