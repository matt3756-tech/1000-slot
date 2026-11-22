import { mobileMenuConfig } from './mobile.js';
import { cashoutEligibility, debtResetAt } from './debt.js';
import { listScores } from './storage.js';
import { COINS, PAY_MULTIPLIERS } from './math.js';
import { FONT, SIZE } from './settings.js';
import { animate, easeOut, popupIn, popupOut } from './animation.js';
import { makeWinText } from './win-text.js';

export const money = value => Math.round(value).toLocaleString('en-US');
const safe = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const date = time => new Date(time).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

export function toast(message) {
  const node = document.querySelector('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3400);
}

export class UI {
  constructor(render, settings, player, audio, action, startup) {
    this.render = render;
    this.s = settings;
    this.player = player;
    this.audio = audio;
    this.action = action;
    this.startup = startup;
    this.root = render.app.stage.addChild(new PIXI.Container());
    this.root.eventMode = 'none';
    this.layer = document.querySelector('#popup-layer');
    this.overlay = document.querySelector('#popup-overlay');
    this.content = document.querySelector('#dialog-content');
    this.body = this.content.querySelector('.dialog-body');
    this.heading = this.content.querySelector('h2');
    this.close = this.content.querySelector('.close-dialog');
    this.close.addEventListener('click', () => this.hideModal());
    this.overlay.addEventListener('pointerdown', event => {
      if (event.target === this.overlay) this.hideModal();
    });
    document.addEventListener('pointerdown', event => {
      if (!this.modal || event.target.closest('#popup-overlay,#editor,#editor-toggle')) return;
      this.hideModal();
    });
  }

  thumbnail(id) {
    return this.render.urls[id];
  }

  clearLine() {
    this.lineEpoch = (this.lineEpoch || 0) + 1;
    if (this.linePopup) this.linePopup.destroy({ children: true });
    this.linePopup = null;
  }

  async showLine(amount, preview = false, refresh = false) {
    this.clearLine();
    const cfg = { ...this.s.popups.line, fontFamily: 'Coin Pixel', fontWeight: 'normal' };
    if (!cfg.enabled && !preview) return;
    const epoch = this.lineEpoch;
    const node = new PIXI.Container();
    const label = makeWinText(refresh ? money(amount) : '0', cfg, this.s.textEffects.line, this.render.textQuality, cfg.w);
    node.position.set(cfg.x, cfg.y);
    node.alpha = 0;
    node.addChild(label);
    this.root.addChild(node);
    this.linePopup = node;
    if (refresh) {
      node.alpha = cfg.alpha;
      node.scale.set(cfg.scale);
      return;
    }
    await Promise.all([
      popupIn(node, cfg),
      animate(cfg.countDuration, p => {
        if (epoch === this.lineEpoch) label.text = money(amount * easeOut(p));
      }, this.render.app.ticker)
    ]);
    if (epoch !== this.lineEpoch || preview) return;
    await animate(cfg.holdDuration, () => {}, this.render.app.ticker);
    if (epoch === this.lineEpoch) await popupOut(node, cfg);
    if (epoch === this.lineEpoch) this.clearLine();
  }

  menuConfig(kind) {
    return mobileMenuConfig(this.s.popups[kind], this.s, this.render.mobile && !this.render.editMode);
  }

  positionContent() {
    const canvas = this.render.app.view.getBoundingClientRect();
    const area = this.layer.getBoundingClientRect();
    this.overlay.style.setProperty('--fit', canvas.width / SIZE);
    this.overlay.style.left = canvas.left - area.left + 'px';
    this.overlay.style.top = canvas.top - area.top + 'px';
    if (!this.modal) return;
    const cfg = this.menuConfig(this.modal.kind);
    Object.assign(this.content.style, {
      left: cfg.x + 'px', top: cfg.y + 'px', width: cfg.w + 'px', height: cfg.h + 'px'
    });
    for (const [key, value] of Object.entries({
      '--panel-scale': cfg.scale, '--heading-size': cfg.fontSize + 'px',
      '--body-size': cfg.subSize + 'px', '--panel-ink': cfg.color, '--panel-fill': cfg.fill,
      '--panel-opacity': cfg.fillAlpha * 100 + '%', '--panel-border': cfg.border,
      '--panel-line': cfg.borderWidth + 'px', '--panel-radius': cfg.radius + 'px',
      '--grain': cfg.textureAlpha
    })) this.content.style.setProperty(key, value);
    this.layer.style.setProperty('--modal-dim', cfg.dim);
  }

  createPopup(kind, title, preview = false) {
    this.hideModal(true);
    this.clearLine();
    this.modal = { kind, title, preview };
    this.heading.textContent = title;
    this.content.dataset.kind = kind;
    this.layer.hidden = false;
    this.positionContent();
    const cfg = this.menuConfig(kind);
    this.dialogAnimation = this.content.animate(
      [{ opacity: 0, scale: '.96' }, { opacity: 1, scale: '1' }],
      { duration: cfg.inDuration, easing: 'ease-out' }
    );
    if (!preview) this.close.focus({ preventScroll: true });
    return this.modal;
  }

  menu(title, markup, kind = 'menu', preview = false) {
    this.createPopup(kind, title, preview);
    this.body.innerHTML = markup;
  }

  hideModal(instant = false) {
    if (!this.modal && !instant) return;
    const kind = this.modal?.kind;
    this.modal = null;
    this.dialogAnimation?.cancel();
    if (instant || !kind) {
      this.layer.hidden = true;
      this.body.replaceChildren();
      return;
    }
    this.dialogAnimation = this.content.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: this.menuConfig(kind).outDuration, easing: 'ease-in', fill: 'forwards' }
    );
    this.dialogAnimation.onfinish = () => {
      if (this.modal) return;
      this.layer.hidden = true;
      this.body.replaceChildren();
    };
  }

  mainMenu(preview = false) {
    this.menu('MENU', '<div class="menu-items"></div>', 'menu', preview);
    const entries = [
      ['PAYS', () => this.pays()], ['LEADERBOARD', () => this.leaderboard()],
      ['CASH OUT / DEBT', () => this.cashMenu()], ['VOLUME', () => this.volumeMenu()]
    ];
    for (const [label, open] of entries) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', () => { if (!preview) { this.audio.play('click'); open(); } });
      this.body.firstElementChild.append(button);
    }
  }

  pays(preview = false) {
    const thumb = id => `<img src="${this.thumbnail(id)}" alt="${id.slice(4)}">`;
    const row = (label, thumbnails, multiplier) =>
      `<li><span class="pay-coins">${thumbnails}</span><span>${label}</span><b>${money(this.player.bet * multiplier)}</b></li>`;
    const rows = COINS.map(id => row('3 × ' + id.slice(4), thumb(id).repeat(3), PAY_MULTIPLIERS[id]));
    rows.push(row('Any mix', COINS.map(thumb).join(''), PAY_MULTIPLIERS.mixed));
    this.menu('PAYS', `<p class="note">Credits at a ${money(this.player.bet)}-credit bet</p>
      <ul class="pays-list">${rows.join('')}</ul><p class="note">All three center stops must contain coins.</p>`, 'pays', preview);
    this.applyPays();
  }

  applyPays() {
    const cfg = this.s.paysLayout;
    this.content.style.setProperty('--thumb', cfg.thumbnailHeight + 'px');
    this.content.style.setProperty('--pay-gap', cfg.gap + 'px');
    this.content.style.setProperty('--pay-padding', cfg.cardPadding + 'px');
  }

  leaderboard(preview = false) {
    const scores = preview ? [{ name: 'MATT', score: 24500, date: Date.now() }] : listScores(this.player, this.s.leaderboard.maxRows);
    const rows = scores.map((entry, i) => `<tr><td>${i + 1}</td><td>${safe(entry.name)}</td><td>${money(entry.score)}</td><td>${date(entry.date)}</td></tr>`);
    this.menu('LEADERBOARD', scores.length
      ? `<table><thead><tr><th>#</th><th>Player</th><th>Credits</th><th>Date</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : '<p class="note">Cash out to record your first local score.</p>', 'leaderboard', preview);
  }

  cashMenu(preview = false, message = '') {
    const rules = this.s.cashoutRules;
    const player = this.player;
    const eligibility = cashoutEligibility(player, rules);
    const reset = debtResetAt(player, rules);
    const max = Math.floor(Math.min(player.credits, player.debt) / 1000);
    const options = count => Array.from({ length: count }, (_, i) =>
      `<option value="${1000 * (i + 1)}">${money(1000 * (i + 1))}</option>`).join('');
    const disable = preview ? ' disabled' : '';
    const repay = player.debt ? `
      <div class="row"><select id="repay-amount" aria-label="Repayment amount" ${!max ? 'disabled' : disable}>
      ${max ? options(Math.min(max, 10)) : '<option>Need 1,000 credits</option>'}</select>
      <button id="repay" ${!max ? 'disabled' : disable}>Pay back</button></div>` : '';
    this.menu('CASH OUT / DEBT', `
      <div class="cash-summary"><div>Credits <b>${money(player.credits)}</b></div><div>Debt <b>${money(player.debt)}</b></div></div>
      <p class="note">Current cash-out minimum ${money(eligibility.minimum)} credits.</p>
      <div class="row"><select id="borrow-amount" aria-label="Rebuy amount"${disable}>${options(10)}</select>
      <button id="borrow"${disable}>Rebuy credits</button></div>${repay}
      <p class="note">Rebuys add to debt. ${reset ? 'Debt resets ' + date(reset) + '.' : 'Debt resets ' + rules.resetDays + ' days after your first rebuy.'}</p>
      <form class="row" id="cash-form"><input id="player-name" autocomplete="off" maxlength="24" placeholder="Player name" aria-label="Player name"${disable}>
      <button ${eligibility.allowed ? disable : 'disabled'} type="submit">Cash out</button></form>
      <p class="note" id="cash-note" role="status">${safe(message || eligibility.reason || 'Cash out records a local score and restarts your balance at 1,000 credits.')}</p>`, 'cashout', preview);
    if (preview) return;
    this.body.querySelector('#borrow').addEventListener('click', () => this.action('borrow', Number(this.body.querySelector('#borrow-amount').value)));
    this.body.querySelector('#repay')?.addEventListener('click', () => this.action('repay', Number(this.body.querySelector('#repay-amount').value)));
    this.body.querySelector('#cash-form').addEventListener('submit', event => {
      event.preventDefault();
      this.action('cashout', this.body.querySelector('#player-name').value);
    });
  }

  volumeMenu(preview = false) {
    const row = (kind, label) => {
      const value = Math.round((this.audio.preferences[kind + 'Level'] ?? 1) * 100);
      return `<div class="volume-row"><label for="volume-${kind}">${label}</label>
        <button type="button" data-mute="${kind}" aria-pressed="${!this.audio.preferences[kind]}">${this.audio.preferences[kind] ? 'ON' : 'OFF'}</button>
        <input id="volume-${kind}" data-level="${kind}" type="range" min="0" max="100" value="${value}">
        <output for="volume-${kind}">${value}%</output></div>`;
    };
    this.menu('VOLUME', row('sfx', 'SFX') + row('music', 'Music'), 'volume', preview);
    this.body.style.setProperty('--volume-gap', this.s.volumeMenu.rowGap + 'px');
    this.body.querySelectorAll('[data-level]').forEach(input => input.addEventListener('input', () => {
      if (!preview) this.audio.setLevel(input.dataset.level, Number(input.value) / 100);
      input.nextElementSibling.value = input.value + '%';
    }));
    this.body.querySelectorAll('[data-mute]').forEach(button => button.addEventListener('click', () => {
      if (preview) return;
      const kind = button.dataset.mute;
      this.audio.setPreference(kind, !this.audio.preferences[kind]);
      button.textContent = this.audio.preferences[kind] ? 'ON' : 'OFF';
      button.setAttribute('aria-pressed', String(!this.audio.preferences[kind]));
    }));
  }

  previewPopup(kind, enabled = true, refresh = false) {
    this.startup.hidePreview();
    this.clearLine();
    this.hideModal(true);
    if (!enabled) return;
    if (kind === 'line') this.showLine(this.s.popups.line.previewValue, true, refresh);
    else if (kind === 'startup') this.startup.preview();
    else if (kind === 'menu') this.mainMenu(true);
    else if (kind === 'cashout') this.cashMenu(true);
    else if (kind === 'volume') this.volumeMenu(true);
    else this[kind](true);
  }
}
