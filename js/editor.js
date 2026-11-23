import { editorAccess } from './editor-access.js';
import { clone, getPath, limits, mergeSettings, normalizePayout, popupKinds, saveSettings, updateLayoutField, clamp } from './settings.js';
import { COINS, WIN_LABELS } from './math.js';
import { toast } from './ui.js';
import { SFX_LABELS } from './audio.js';
import { DEFAULT_SPINS, MAX_SPINS, MIN_SPINS, returnOdds, simulate, simulationCount } from './simulation.js';

const nice = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
const labelFor = key => ({
  betMinus: 'Bet −', betPlus: 'Bet +', cashout: 'Cash out / debt', line: 'Line amount', startup: 'Start screen'
})[key] ?? nice(key);
const $ = (root, id) => root.querySelector('#' + id);

const tooltip = {
  speed: 'Reel cells per second during cruise.',
  stagger: 'Milliseconds between regular reel stops.',
  startDuration: 'Set to zero for an immediate start.',
  stopDuration: 'Set to zero for an immediate regular stop. Anticipation has its own deceleration.',
  spacing: 'Center-to-center distance between stops. Small values are limited by the reel window height.',
  weight: 'Relative share of coin stops after the blank chance is applied.',
  blankPercent: 'Chance that any one reel lands a blank on the payline.',
  syncToBell: 'Shake until the bonus bell finishes. Turn off to use the duration below.',
  snapEnabled: 'Align dragged objects to the canvas grid.',
  shadowAngle: 'Direction of the amount shadow in degrees.'
};

export class Editor {
  constructor(settings, render, ui, callbacks) {
    this.s = settings;
    this.render = render;
    this.ui = ui;
    this.cb = callbacks;
    this.el = document.querySelector('#editor');
    this.button = document.querySelector('#editor-toggle');
    this.path = 'slot';
    this.undoStack = [];
    this.previewKind = null;
    this.open = false;
    this.enabled = editorAccess(document.body.dataset.editor).enabled;
    this.button.hidden = !editorAccess(document.body.dataset.editor).buttonVisible;
    if (!this.enabled) return;
    this.build();
    this.button.addEventListener('click', () => this.toggle());
    this.button.setAttribute('aria-expanded', 'false');
  }

  groups() {
    return [
      ['slot', 'Cabinet'], ['background', 'Background'], ['reels', 'Reels, spacing + blank chance'],
      ['spin', 'Reel start, speed + stop'], ['anticipation', 'Anticipation timing'],
      ['anticipationChase', 'Anticipation reel glow'], ['landing', 'Coin landing glow + sparkles'],
      ['winning', 'Winning coin pop + glow'],
      ['winShake', 'Big Win / Jackpot shake'],
      ...COINS.map(id => ['symbols.' + id, id.slice(4) + ' coin']),
      ['payouts', 'Winning combination pays'],
      ...Object.keys(this.s.buttons).flatMap(id => [
        ['buttons.' + id, labelFor(id) + ' button'], ['masks.' + id, labelFor(id) + ' press mask']
      ]),
      ...Object.keys(this.s.hud).map(id => ['hud.' + id, this.s.hud[id].label + ' display']),
      ['payline', 'Payline markers'],
      ...popupKinds.map(kind => [kind === 'startup' ? kind : 'popups.' + kind, labelFor(kind) + ' popup']),
      ['textEffects.line', 'Line amount text effects'], ['paysLayout', 'Paytable thumbnails'],
      ['leaderboard', 'Leaderboard'], ['cashoutRules', 'Cash-out and debt rules'],
      ['volumeMenu', 'Volume menu'], ['audio', 'Audio levels and timing'],
      ['performance', 'Mobile and performance'], ['textRendering', 'Text sharpness'], ['editorGrid', 'Grid and snapping']
    ];
  }

  build() {
    this.el.innerHTML = `
      <div class="editor-heading"><h1>Slot editor</h1><button id="editor-close" aria-label="Close editor">×</button></div>
      <div class="toolbar"><button id="save-settings">Save</button><button id="export-settings">Export</button>
        <button id="import-settings">Import</button><button id="undo" disabled>Undo</button><button id="switch-side">Switch side</button>
        <button id="reset-settings">Defaults</button></div>
      <input id="settings-file" type="file" accept=".json,application/json" hidden>
      <h2>Alignment</h2><label class="check"><input id="grid-snap" type="checkbox"> Snap to grid</label>
      <div class="toolbar"><button id="grid-settings">Grid settings</button></div>
      <h2><label for="element">Element</label></h2>
      <select id="element">${this.groups().map(([path, label]) => `<option value="${path}">${label}</option>`).join('')}</select>
      <div id="controls"></div>
      <h2>Popup previews</h2>
      <div class="toolbar">${popupKinds.map(kind => `<button data-popup="${kind}" aria-pressed="false">${labelFor(kind)}</button>`).join('')}
        <button id="close-preview">Hide</button></div>
      <h2>Reel and effect previews</h2>
      <label for="spin-case">Test outcome</label>
      <select id="spin-case">
        <option value="random">Random spin</option><option value="blank">Blanks</option>
        <option value="mixed">Mixed win</option><option value="coin10">10 match</option>
        <option value="coin100">100 match</option><option value="coin1000">1000 match</option>
        <option value="miss">1000 anticipation miss</option><option value="pairMiss">100 pair miss</option>
      </select>
      <div class="toolbar"><button id="spin-preview">Test spin</button><button id="landing-preview">Landing glow</button><button id="winning-preview">Winning coins</button>
        <button id="anticipation-preview">Reel glow</button><button id="symbol-preview">Show symbol</button><button id="press-preview">Button press</button></div>
      <h2>RTP calculator</h2>
      <div class="hint" id="weights-overview"></div>
      <div class="toolbar"><button id="blank-settings">Edit blank chance</button><button id="payout-settings">Edit pays</button></div>
      <label for="sim-count">Simulation spins</label>
      <div class="sim-inputs"><input type="range" id="sim-slider" aria-label="Simulation spin count" min="${MIN_SPINS}" max="${MAX_SPINS}" step="1000" value="${DEFAULT_SPINS}">
        <input type="number" id="sim-count" min="${MIN_SPINS}" max="${MAX_SPINS}" step="1" value="${DEFAULT_SPINS}"></div>
      <div class="toolbar"><button id="run-rtp">Calculate RTP</button><button id="cancel-rtp" disabled>Cancel</button></div>
      <div id="rtp-result" class="result" role="status"></div>`;
    const el = this.el;
    const click = (id, handler) => $(el, id).addEventListener('click', handler);
    $(el, 'element').addEventListener('change', event => this.select(event.target.value));
    click('editor-close', () => this.toggle(false));
    click('switch-side', () => this.side(el.dataset.side === 'left' ? 'right' : 'left'));
    click('grid-settings', () => this.select('editorGrid'));
    $(el, 'grid-snap').addEventListener('change', event => {
      this.snapshot();
      this.s.editorGrid.snapEnabled = event.target.checked;
      this.cb.apply();
      this.controls();
    });
    click('undo', () => this.undo());
    click('save-settings', () => {
      try { saveSettings(this.s); toast('Editor settings saved.'); }
      catch (error) { toast(error.message); }
    });
    click('export-settings', () => this.export());
    click('import-settings', () => $(el, 'settings-file').click());
    $(el, 'settings-file').addEventListener('change', async event => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        const input = JSON.parse(await file.text());
        if (!input || typeof input !== 'object' || !(input.settings ?? input).slot) throw Error('Choose a Coin 10s settings JSON file.');
        this.replace(mergeSettings(input, this.cb.fileDefaults));
        toast('Settings imported. Use Save to keep them in this browser.');
      } catch (error) { toast(error.message); }
      finally { event.target.value = ''; }
    });
    click('reset-settings', () => this.replace(this.cb.fileDefaults));
    el.querySelectorAll('[data-popup]').forEach(button => button.addEventListener('click', () => {
      const kind = button.dataset.popup;
      this.preview(this.previewKind === kind ? null : kind, true);
    }));
    click('close-preview', () => this.preview(null));
    click('spin-preview', async () => {
      this.preview(null);
      await this.cb.spinPreview($(el, 'spin-case').value);
    });
    for (const [id, kind] of [['landing-preview', 'landing'], ['winning-preview', 'winning'], ['anticipation-preview', 'anticipation'],
      ['symbol-preview', 'symbol'], ['press-preview', 'press']]) {
      click(id, () => {
        this.preview(null);
        this.cb.effectPreview(kind, this.path, $(el, 'spin-case').value);
      });
    }
    $(el, 'sim-slider').addEventListener('input', event => { $(el, 'sim-count').value = event.target.value; });
    $(el, 'sim-count').addEventListener('change', event => {
      const value = simulationCount(event.target.value, MIN_SPINS);
      $(el, 'sim-slider').value = value;
      event.target.value = value;
    });
    click('blank-settings', () => {
      this.select('reels');
      $(el, 'field-reels-blankPercent').focus();
    });
    click('payout-settings', () => {
      this.select('payouts');
      $(el, 'field-payouts-coin10').focus();
    });
    click('run-rtp', () => this.runRtp());
    click('cancel-rtp', () => this.cancelRtp());
    let side;
    try { side = localStorage.getItem('coin10s.editor.side'); } catch {}
    this.side(side === 'left' ? 'left' : 'right');
    this.select('slot');
  }

  side(side) {
    this.el.dataset.side = side;
    document.body.dataset.editorSide = side;
    try { localStorage.setItem('coin10s.editor.side', side); } catch {}
    this.cb.resize();
  }

  toggle(open = !this.open) {
    if (!this.enabled || this.cb.getBusy()) return;
    this.preview(null);
    this.cb.clearEffectPreview();
    if (!open) this.cancelRtp();
    this.open = open;
    this.render.editMode = open;
    this.el.hidden = !open;
    document.body.classList.toggle('editing', open);
    this.button.setAttribute('aria-expanded', String(open));
    this.cb.apply();
    this.cb.resize();
    this.highlight();
  }

  select(path) {
    if (!this.enabled || !getPath(this.s, path)) return;
    this.path = path;
    this.render.editorPath = path;
    $(this.el, 'element').value = path;
    this.controls();
    this.highlight();
    this.cb.apply();
  }

  controls() {
    const config = getPath(this.s, this.path);
    const box = $(this.el, 'controls');
    $(this.el, 'grid-snap').checked = this.s.editorGrid.snapEnabled;
    box.replaceChildren();
    if (this.path === 'audio') {
      const toolbar = document.createElement('div');
      toolbar.className = 'toolbar';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Sound cue');
      for (const [cue, label] of Object.entries(SFX_LABELS)) select.add(new Option(label, cue));
      const button = document.createElement('button');
      button.textContent = 'Preview sound';
      button.addEventListener('click', () => this.cb.audioPreview(select.value));
      toolbar.append(select, button);
      box.append(toolbar);
    }
    if (this.path === 'payouts') {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Pays are multiples of the current bet. Set a pay to 0 to disable it.';
      box.append(hint);
    }
    for (const [key, value] of Object.entries(config)) {
      const row = document.createElement('div'), label = document.createElement('label');
      const path = this.path + '.' + key;
      row.className = 'control';
      const cueField = this.path === 'audio' && /^(.*?)(Volume|TimingMs|OffsetMs)$/.exec(key);
      const name = this.path === 'payouts' ? WIN_LABELS[key] + ' (× bet)'
        : cueField && SFX_LABELS[cueField[1]]
        ? SFX_LABELS[cueField[1]] + ' · ' + nice(cueField[2]).toLowerCase()
        : key === 'blankPercent' ? 'Blank chance (%)'
        : key === 'h' && /^popups\.(?!line$)/.test(this.path) ? 'Max height' : nice(key);
      label.textContent = name;
      label.title = tooltip[key] ?? '';
      row.append(label);
      const onChange = next => {
        updateLayoutField(this.s, path, next);
        this.cb.apply();
        this.weights();
        this.queuePreviewUpdate();
      };
      const input = document.createElement('input');
      input.id = 'field-' + path.replaceAll('.', '-');
      label.htmlFor = input.id;
      input.dataset.path = path;
      if (this.path === 'payouts') {
        input.type = 'number';
        Object.assign(input, limits(path, value), { value });
        label.append(input);
        input.addEventListener('change', () => {
          const next = Number.isFinite(input.valueAsNumber) ? normalizePayout(input.valueAsNumber) : getPath(this.s, path);
          this.snapshot();
          onChange(next);
          input.value = next;
        });
      } else if (typeof value === 'number') {
        const range = limits(path, value), number = document.createElement('input');
        number.type = 'number';
        number.setAttribute('aria-label', name + ' value');
        number.dataset.path = path;
        input.type = 'range';
        for (const slider of [number, input]) {
          Object.assign(slider, range, { value });
        }
        label.append(number);
        row.append(input);
        input.addEventListener('pointerdown', () => this.snapshot());
        input.addEventListener('keydown', event => {
          if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) this.snapshot();
        });
        input.addEventListener('input', () => {
          number.value = input.value;
          onChange(Number(input.value));
        });
        number.addEventListener('change', () => {
          this.snapshot();
          const next = clamp(number.valueAsNumber || 0, range.min, range.max);
          onChange(next);
          input.value = number.value = next;
        });
      } else {
        input.type = typeof value === 'boolean' ? 'checkbox' : value.startsWith('#') ? 'color' : 'text';
        input.checked = value === true;
        if (input.type !== 'checkbox') input.value = value;
        row.append(input);
        input.addEventListener('change', () => {
          this.snapshot();
          onChange(input.type === 'checkbox' ? input.checked : input.value);
        });
      }
      box.append(row);
    }
    this.weights();
  }

  highlight() { this.render.highlight(this.path); }

  syncPosition() {
    const config = getPath(this.s, this.path);
    for (const key of ['x', 'y']) {
      this.el.querySelectorAll(`[data-path="${this.path}.${key}"]`).forEach(input => { input.value = config[key]; });
    }
    this.highlight();
  }

  weights() {
    const total = COINS.reduce((sum, id) => sum + this.s.symbols[id].weight, 0);
    $(this.el, 'weights-overview').textContent = total
      ? `Blank per reel ${this.s.reels.blankPercent}% · Coin mix ` + COINS.map(id => `${id.slice(4)}: ${(100 * this.s.symbols[id].weight / total).toFixed(1)}%`).join(' · ')
      : 'Set at least one coin weight above zero.';
  }

  snapshot() {
    const state = JSON.stringify(this.s);
    if (this.undoStack.at(-1) === state) return;
    this.undoStack.push(state);
    if (this.undoStack.length > 60) this.undoStack.shift();
    $(this.el, 'undo').disabled = false;
  }

  undo() {
    if (!this.undoStack.length || this.cb.getBusy()) return;
    Object.assign(this.s, JSON.parse(this.undoStack.pop()));
    $(this.el, 'undo').disabled = !this.undoStack.length;
    this.controls();
    this.cb.apply();
    this.queuePreviewUpdate();
  }

  replace(data) {
    if (this.cb.getBusy()) return;
    this.snapshot();
    Object.assign(this.s, clone(data));
    this.controls();
    this.cb.apply();
    this.queuePreviewUpdate();
  }

  export() {
    try {
      const blob = new Blob([JSON.stringify(mergeSettings(this.s), null, 2) + '\n'], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'current-settings.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { toast(error.message); }
  }

  preview(kind, select = false) {
    if (kind && this.cb.getBusy()) return;
    this.previewKind = kind;
    this.el.querySelectorAll('[data-popup]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.popup === kind));
    });
    if (kind && select) this.select(kind === 'startup' ? kind : 'popups.' + kind);
    this.ui.previewPopup(kind, Boolean(kind));
  }

  queuePreviewUpdate() {
    if (!this.previewKind || this.previewFrame) return;
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = null;
      if (this.previewKind) this.ui.previewPopup(this.previewKind, true, true);
    });
  }

  setRtpRunning(running) {
    $(this.el, 'run-rtp').disabled = running;
    $(this.el, 'cancel-rtp').disabled = !running;
  }

  cancelRtp() {
    if (!this.simulation) return;
    this.simulation.abort();
    this.simulation = null;
    this.setRtpRunning(false);
    $(this.el, 'rtp-result').textContent = 'Simulation cancelled.';
  }

  async runRtp() {
    const result = $(this.el, 'rtp-result');
    const pct = value => (value * 100).toFixed(2) + '%';
    const run = new AbortController();
    this.simulation?.abort();
    this.simulation = run;
    try {
      const odds = returnOdds(mergeSettings(this.s));
      const count = $(this.el, 'sim-count').valueAsNumber;
      const spins = simulationCount(count);
      const expected = `Expected RTP ${pct(odds.expected)}
Expected win frequency ${pct(odds.hitRate)}`;
      const combinationPct = value => {
        const percent = value * 100;
        return (percent > 0 && percent < .0001 ? percent.toPrecision(2) : percent.toFixed(4)) + '%';
      };
      const breakdown = report => 'Combination frequency (% of all spins)\n' + odds.wins.map(({ id, probability, payout }, index) => {
        const exact = `${WIN_LABELS[id]}${payout === 0 ? ' (no pay)' : ''} · ${combinationPct(probability)} exact`;
        return report ? exact + ` · ${combinationPct(report.combinations[index].frequency)} simulated` : exact;
      }).join('\n');
      result.textContent = expected + '\n\n' + breakdown() + '\n\nRunning simulation…';
      this.setRtpRunning(true);
      const report = await simulate(odds, spins, { signal: run.signal });
      if (!report || this.simulation !== run) return;
      result.textContent = `${spins.toLocaleString('en-US')} spins
${expected}
Simulated RTP ${pct(report.rtp)}
Simulated win frequency ${pct(report.hitRate)}

${breakdown(report)}`;
    } catch (error) {
      if (this.simulation === run) result.textContent = error.message;
    } finally {
      if (this.simulation === run) {
        this.simulation = null;
        this.setRtpRunning(false);
      }
    }
  }
}
