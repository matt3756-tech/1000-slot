import { mediaSource } from './assets.js';
import { spinReels, animate } from './animation.js';
import { AudioSystem } from './audio.js';
import { Controls } from './controls.js';
import { refreshDebt } from './debt.js';
import { Editor } from './editor.js';
import { BLANK, COINS, borrow, lineWin, repay } from './math.js';
import { baseOutcome, cell, centerIds } from './outcomes.js';
import { Renderer } from './rendering.js';
import { BETS, FONT, SIZE, loadSettings, mergeSettings } from './settings.js';
import { Startup } from './startup.js';
import { cashOut, loadPlayer, savePlayer } from './storage.js';
import { UI, money, toast } from './ui.js';

const { settings, fileDefaults } = await loadSettings();
const player = loadPlayer(settings.cashoutRules);
const startup = new Startup(settings);
const audio = new AudioSystem(() => settings);
const stage = document.querySelector('#stage');
let render, controls, ui, editor, board, peeks = [], busy = false, ready = false;
let displayPlayer = player, previewToken = 0;
const audioMedia = Object.fromEntries(Object.entries({
  click: 'spin-start', stop: 'reel-stop', win: 'line-win', anticipate: 'anticipation', music: 'base-music'
}).map(([key, file]) => ['audio:' + key, 'assets/audio/' + file + '.mp3']));

const testCases = {
  blank: [BLANK, BLANK, BLANK],
  mixed: ['coin10', 'coin100', 'coin1000'],
  coin10: ['coin10', 'coin10', 'coin10'],
  coin100: ['coin100', 'coin100', 'coin100'],
  coin1000: ['coin1000', 'coin1000', 'coin1000'],
  miss: ['coin1000', BLANK, 'coin1000'],
  pairMiss: ['coin100', 'coin100', BLANK]
};

function persist(next = player) {
  savePlayer(next);
  Object.assign(player, next);
}

function update() {
  controls.update(displayPlayer, busy);
  document.querySelector('#game-area').setAttribute('aria-busy', String(busy));
  document.querySelector('#balance-summary').textContent =
    `Credits ${money(displayPlayer.credits)}. Bet ${money(displayPlayer.bet)}. Last win ${money(displayPlayer.lastWin)}.`;
}

function resize() {
  if (!render) return;
  const size = Math.min(stage.clientWidth, stage.clientHeight);
  render.app.view.style.width = render.app.view.style.height = size + 'px';
  render.resizeQuality();
  ui?.positionContent();
  startup.apply();
}

function apply() {
  render.apply();
  controls.apply();
  ui.applyPays();
  ui.positionContent();
  startup.apply();
  editor?.highlight();
  audio.startMusic();
}

function clearEffectPreview() {
  previewToken++;
  render.effects.clear();
  render.setAnticipation([]);
  audio.stopAnticipation();
  if (!render.motions) render.endSpin(board, peeks);
}

async function spin({ preview = false, kind } = {}) {
  if (!ready || busy || ui.modal || (render.editMode && !preview)) return;
  if (!preview && refreshDebt(player, settings.cashoutRules)) persist();
  if (!preview && player.credits < player.bet) { ui.cashMenu(); return; }
  let next, nextSettings;
  try {
    nextSettings = mergeSettings(settings);
    next = baseOutcome(nextSettings, preview ? testCases[kind] : undefined);
  } catch (error) { toast(error.message); return; }
  const bet = player.bet;
  const amount = lineWin(centerIds(next), bet);
  const old = board;
  const oldPeeks = peeks;
  clearEffectPreview();
  ui.clearLine();
  if (!preview) {
    // Record the complete paid result atomically. Reloading during the animation
    // preserves both the wager and any win once.
    const settled = {
      ...player, credits: player.credits - bet + amount, lastWin: amount || player.lastWin, board: next
    };
    displayPlayer = { ...player, credits: player.credits - bet };
    try { persist(settled); }
    catch (error) { displayPlayer = player; toast(error.message); return; }
  }
  busy = true;
  update();
  try {
    const adjacent = await spinReels(render, old, next, nextSettings, audio, oldPeeks);
    if (!preview) {
      board = next;
      peeks = adjacent;
    }
    if (amount) {
      const effect = nextSettings.winning;
      for (let i = 0; i < 3; i++) render.effects.start(i, next[i][1], 'winning');
      if (effect.enabled) await animate(effect.duration, () => {}, render.app.ticker);
      if (!preview) { displayPlayer = player; update(); }
      if (settings.popups.line.enabled) await audio.present('win', () => {});
      else audio.play('win');
      await ui.showLine(amount);
    }
  } catch (error) {
    if (!preview) board = next;
    peeks = [];
    toast('Reel animation interrupted. ' + error.message);
  } finally {
    if (preview) render.effects.clear();
    render.endSpin(board, peeks);
    displayPlayer = player;
    busy = false;
    apply();
    update();
  }
}

function effectPreview(kind, path) {
  if (busy) return;
  clearEffectPreview();
  ui.clearLine();
  const token = previewToken;
  if (kind === 'press') {
    const id = /^(masks|buttons)\./.test(path) ? path.split('.')[1] : 'spin';
    if (!/^(masks|buttons)\./.test(path)) editor.select('masks.spin');
    controls.press(id);
    audio.play('click');
    return;
  }
  if (kind === 'anticipation') {
    editor.select('anticipationChase');
    render.setAnticipation([1, 2]);
    audio.play('anticipate');
    setTimeout(() => { if (previewToken === token) clearEffectPreview(); }, Math.max(2400, settings.anticipationChase.duration * 2));
    return;
  }
  const selected = path.startsWith('symbols.') ? path.split('.')[1] : 'coin100';
  const id = COINS.includes(selected) ? selected : 'coin100';
  const previewBoard = baseOutcome(settings, ['coin10', id, 'coin1000']);
  render.endSpin(previewBoard, []);
  if (kind === 'landing' || kind === 'winning') {
    editor.select(kind);
    render.effects.start(1, previewBoard[1][1], kind);
  }
}

async function action(id, arg) {
  if (!ready || busy || render.editMode) return;
  if (['spin', 'menu', 'betPlus', 'betMinus'].includes(id) && ui.modal) return;
  if (controls.buttons[id]) {
    audio.play('click');
    controls.press(id);
  }
  if (id === 'spin') { await spin(); return; }
  if (id === 'menu') { if (refreshDebt(player, settings.cashoutRules)) persist(); ui.mainMenu(); return; }
  try {
    if (id === 'betPlus' || id === 'betMinus') {
      const index = BETS.indexOf(player.bet) + (id === 'betPlus' ? 1 : -1);
      if (BETS[index]) persist({ ...player, bet: BETS[index] });
    } else if (id === 'borrow' || id === 'repay') {
      const next = { ...player };
      (id === 'borrow' ? borrow : repay)(next, arg, settings.cashoutRules);
      persist(next);
      if (id === 'borrow') ui.hideModal();
      else ui.cashMenu();
    } else if (id === 'cashout') {
      const entry = cashOut(player, arg, settings.cashoutRules);
      toast('Saved ' + money(entry.score) + ' credits to the leaderboard.');
      ui.leaderboard();
    }
    update();
  } catch (error) {
    const note = document.querySelector('#cash-note');
    if (note) note.textContent = error.message;
    else toast(error.message);
  }
}

function restoreBoard(saved) {
  if (Array.isArray(saved) && saved.length === 3 && saved.every(col =>
    Array.isArray(col) && col.length === 3 && col.every(cell => cell && [BLANK, ...COINS].includes(cell.id)))) return saved;
  return [[cell(), cell('coin10'), cell()], [cell('coin100'), cell(), cell('coin100')], [cell(), cell('coin1000'), cell()]];
}

async function boot() {
  startup.apply();
  const fonts = [[FONT, 'assets/fonts/Matcha-Squishy.otf'], ['Coin Pixel', 'assets/fonts/Coin-Pixel.ttf']];
  const preloadFont = async ([name, path]) => {
    const face = new FontFace(name, `url("${mediaSource(path)}")`);
    document.fonts.add(await face.load());
  };
  const preloadImage = async (path, variable) => {
    const image = new Image();
    image.src = mediaSource(path);
    await image.decode();
    document.documentElement.style.setProperty(variable, `url("${image.src}")`);
  };
  await Promise.all([
    ...fonts.map(preloadFont),
    preloadImage('assets/gray-gradient.jpg', '--gray-background'),
    preloadImage('assets/menu-grain.png', '--menu-grain')
  ]);
  render = new Renderer(settings);
  await Promise.all([render.load(), audio.loadMedia(audioMedia)]);
  controls = new Controls(render, settings, action);
  ui = new UI(render, settings, player, audio, action, startup);
  const coins = document.querySelector('#boot-coins');
  for (const id of COINS) {
    const node = new Image();
    node.src = render.urls[id];
    node.alt = '';
    coins.append(node);
  }
  await Promise.all([...coins.children].map(node => node.decode()));
  board = restoreBoard(player.board);
  render.endSpin(board, peeks);
  editor = new Editor(settings, render, ui, {
    apply, resize, getBusy: () => busy || !ready, spinPreview: kind => spin({ preview: true, kind }),
    effectPreview, clearEffectPreview, fileDefaults
  });
  render.select = path => editor.select(path);
  render.onDragStart = () => editor.snapshot();
  render.onDrag = () => { apply(); editor.syncPosition(); };
  new ResizeObserver(resize).observe(stage);
  resize();
  apply();
  update();
  startup.ready(() => {
    ready = true;
    audio.started = true;
    audio.unlock();
    startup.close();
    if (editor.enabled && document.body.dataset.editor === 'visible') document.querySelector('#editor-toggle').hidden = false;
    document.querySelector('#game-area').inert = false;
    stage.focus({ preventScroll: true });
  });
}

document.addEventListener('keydown', event => {
  if (!ready || event.repeat || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName) && event.key !== 'Escape') return;
  if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey) editor.toggle();
  else if (event.key === 'Escape') {
    if (ui.modal) ui.hideModal();
    else if (editor.open) editor.toggle(false);
  } else if (event.code === 'Space' || event.key === 'Enter') {
    if (ui.modal || editor.open) return;
    event.preventDefault();
    action('spin');
  }
});

boot().catch(error => {
  console.error(error);
  startup.progress('Could not load the game. ' + error.message);
});
