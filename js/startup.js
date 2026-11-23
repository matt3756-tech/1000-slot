import { mediaSource } from './assets.js';
import { SIZE } from './settings.js';

export class Startup {
  constructor(settings) {
    this.s = settings;
    this.el = document.querySelector('#boot');
    this.scene = document.querySelector('#boot-scene');
    this.image = document.querySelector('#boot-art');
    this.status = document.querySelector('#boot-status');
    this.prompt = document.querySelector('#start');
    window.addEventListener('resize', () => this.apply());
  }

  async load() {
    this.apply();
    this.image.src = mediaSource('assets/title-screen.jpeg');
    await this.image.decode();
    this.apply();
    this.image.classList.add('boot-art-ready');
  }

  apply() {
    const cfg = this.s.startup, area = this.el.getBoundingClientRect();
    if (!area.width || !area.height) return;
    const ratio = this.image.naturalWidth / this.image.naturalHeight || 16 / 9;
    const width = Math.min(area.width, area.height * ratio);
    this.scene.style.width = width + 'px';
    this.scene.style.height = width / ratio + 'px';
    this.scene.style.fontSize = Math.max(14, Math.min(32, cfg.fontSize * width / SIZE)) + 'px';
    this.status.style.top = cfg.loadingY / SIZE * 100 + '%';
    this.prompt.style.top = cfg.promptY / SIZE * 100 + '%';
    this.el.style.setProperty('--boot-art-opacity', cfg.imageAlpha);
    this.el.style.setProperty('--boot-entrance', cfg.entranceDuration + 'ms');
    this.el.style.setProperty('--boot-exit', cfg.fadeDuration + 'ms');
  }

  progress(message) { this.status.textContent = message; }

  ready(action) {
    this.progress('');
    this.prompt.hidden = false;
    this.el.addEventListener('click', action, { once: true });
  }

  async close() {
    this.el.classList.add('boot-fade');
    this.el.inert = true;
    const duration = this.s.startup.fadeDuration;
    if (duration > 0) await new Promise(resolve => setTimeout(resolve, duration));
    if (this.el.classList.contains('boot-fade')) this.el.hidden = true;
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
