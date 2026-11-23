import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { motionStrip, planSpin, spinReels, trajectory } from '../js/animation.js';
import { COINS, BLANK, lineWin, borrow, repay, winCombination } from '../js/math.js';
import { MAX_SPINS, returnOdds, simulate } from '../js/simulation.js';
import { baseOutcome, centerIds, reelColumn } from '../js/outcomes.js';
import { cashOut, listScores, loadPlayer, savePlayer } from '../js/storage.js';
import { DAY_MS, refreshDebt } from '../js/debt.js';
import { AudioSystem, WIN_CUES } from '../js/audio.js';
import { Editor } from '../js/editor.js';
import { UI } from '../js/ui.js';
import { Startup } from '../js/startup.js';
import { renderProfile } from '../js/mobile.js';
import { playWinCelebration, shakeCabinet, WIN_COUNT_MS } from '../js/win-celebration.js';
import { BETS, clone, defaults, mergeSettings, updateLayoutField } from '../js/settings.js';

const [ten, hundred, thousand] = COINS;
const config = () => clone(defaults);

test('only the center payline pays, at all supported bets', () => {
  for (const bet of BETS) {
    for (const [id, multiple] of [[ten, 10], [hundred, 100], [thousand, 1000]]) {
      assert.equal(lineWin([id, id, id], bet), bet * multiple);
    }
    for (const mixed of [[ten, ten, hundred], [ten, hundred, thousand], [thousand, ten, ten]]) {
      assert.equal(lineWin(mixed, bet), bet * 5);
    }
    for (const blank of [[BLANK, ten, ten], [ten, BLANK, ten], [ten, ten, BLANK]]) {
      assert.equal(lineWin(blank, bet), 0);
    }
  }
});

test('landed columns and moving strips alternate coins with blanks at every stop', () => {
  for (const oldId of [BLANK, ten, hundred, thousand]) {
    for (const newId of [BLANK, ten, hundred, thousand]) {
      const pick = () => hundred;
      const before = reelColumn(oldId, pick);
      const after = reelColumn(newId, pick);
      const oldMotion = motionStrip(before, before, null, 12, pick);
      for (let steps = 8; steps < 20; steps++) {
        const motion = motionStrip(before, after, oldMotion.adjacent, steps, pick);
        const { strip, steps: distance } = motion;
        assert.equal(strip[1].id, oldId);
        assert.equal(strip[1 - distance].id, newId);
        for (let i = -distance - 5; i < 5; i++) {
          assert.notEqual(strip[i].id === BLANK, strip[i + 1].id === BLANK);
        }
        assert.deepEqual([strip[-distance], strip[1 - distance], strip[2 - distance]], after);
      }
    }
  }
});

test('anticipation starts on eligible contacts and ends after a miss', () => {
  const settings = config();
  const regular = planSpin([ten, hundred, ten], settings);
  assert.deepEqual(regular.phases, []);
  for (const id of [ten, hundred]) {
    const pair = planSpin([id, id, BLANK], settings);
    assert.deepEqual(pair.slow, [false, false, true]);
    assert.deepEqual(pair.phases, [{ start: regular.times[1], end: pair.times[2], reels: [2] }]);
    assert.ok(pair.times[2] > regular.times[2]);
  }
  const miss = planSpin([thousand, BLANK, thousand], settings);
  assert.deepEqual(miss.slow, [false, true, false]);
  assert.deepEqual(miss.phases, [{ start: miss.times[0], end: miss.times[1], reels: [1] }]);
  const match = planSpin([thousand, thousand, thousand], settings);
  assert.deepEqual(match.slow, [false, true, true]);
  assert.deepEqual(match.phases[1], { start: match.times[1], end: match.times[2], reels: [2] });
  assert.ok(match.times[2] > miss.times[2]);
  assert.deepEqual(planSpin([BLANK, thousand, thousand], settings).phases, []);
  settings.anticipation.enabled = false;
  assert.deepEqual(planSpin([thousand, thousand, thousand], settings), regular);
});

test('reel trajectories advance downwards and hit their exact center with or without ramps', () => {
  for (const [a, d] of [[0, 0], [100, 0], [0, 440], [100, 440]]) {
    let previous = 0;
    for (let time = 0; time <= 1000; time++) {
      const y = trajectory(time, 1000, a, d, 1600);
      assert.ok(y >= previous);
      previous = y;
    }
    assert.equal(previous, 1600);
  }
});

test('ticker spin runs all reel contacts once and passes coherent settled strips to rendering', async () => {
  const realPerformance = globalThis.performance;
  let now = 0;
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  try {
    const settings = config(), old = baseOutcome(settings, [ten, hundred, thousand]);
    const next = baseOutcome(settings, [thousand, thousand, thousand]);
    const ticks = new Set(), cues = [], pitches = [], landings = [], anticipation = [];
    const render = {
      geometry: { spacing: settings.reels.spacing },
      chase: { active: [] },
      app: { ticker: { add: tick => ticks.add(tick), remove: tick => ticks.delete(tick) } },
      beginSpin(motions) { assert.equal(motions.length, 3); },
      spinFrame(reel, distance) { assert.ok(distance >= 0 && reel < 3); },
      startLanding(reel, symbol) { landings.push([reel, symbol.id]); },
      landReel(reel, symbols, peeks, settle) { assert.ok(Number.isFinite(settle)); },
      setAnticipation(reels) { this.chase.active = reels; anticipation.push(reels.join(',')); },
      endSpin(settled) { assert.deepEqual(settled, next); }
    };
    let loopEnd, loopCancelled;
    const audio = {
      advance() {},
      play(cue, options) {
        cues.push(cue);
        if (cue === 'land1000') pitches.push(options.rate);
        if (cue === 'reelLoop') {
          loopEnd = options.loopForMs;
          return { cancel: () => { loopCancelled = true; } };
        }
      },
      stopAnticipation() { cues.push('stop anticipation'); }
    };
    const result = spinReels(render, old, next, settings, audio);
    for (; now <= 6000; now += 16) for (const tick of ticks) tick();
    const peeks = await result;
    assert.deepEqual(landings, [[0, thousand], [1, thousand], [2, thousand]]);
    assert.deepEqual(cues, ['reelLoop', 'stop', 'land1000', 'anticipate',
      'stop', 'land1000', 'stop anticipation', 'anticipate',
      'stop', 'land1000', 'stop anticipation', 'stop anticipation']);
    assert.deepEqual(pitches, [1, 2 ** .25, 2 ** .5]);
    assert.equal(loopEnd, planSpin(centerIds(next), settings).times[2]);
    assert.equal(loopCancelled, true);
    assert.deepEqual(anticipation, ['1', '2', '', '']);
    assert.deepEqual(render.chase.active, []);
    assert.equal(peeks.length, 3);
  } finally {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: realPerformance });
  }
});

test('outcomes and exact RTP both honor the editable blank probability', () => {
  const settings = config();
  const rng = () => .4;
  settings.symbols.coin100.weight = settings.symbols.coin1000.weight = 0;
  for (const [blank, expected, center] of [[0, 10, ten], [25, 4.21875, ten], [50, 1.25, BLANK], [100, 0, BLANK]]) {
    settings.reels.blankPercent = blank;
    const odds = returnOdds(settings);
    assert.ok(Math.abs(odds.expected - expected) < 1e-12);
    assert.deepEqual(centerIds(baseOutcome(settings, undefined, rng)), [center, center, center]);
  }
  assert.deepEqual(centerIds(baseOutcome(settings, [ten, hundred, thousand], rng)), [ten, hundred, thousand]);
});

test('custom payouts and exact combination odds agree with all reel stops', () => {
  const settings = config();
  settings.reels.blankPercent = 35;
  settings.payouts = { coin10: 7.3, coin100: 14.2, coin1000: 0, mixed: 2.5 };
  assert.deepEqual(BETS.map(bet => lineWin([ten, ten, ten], bet, settings.payouts)),
    [73, 146, 219, 292, 365, 438, 511, 584, 657, 730]);
  const totalWeight = COINS.reduce((sum, id) => sum + settings.symbols[id].weight, 0);
  const symbols = [BLANK, ...COINS];
  const probability = id => id === BLANK ? .35 : .65 * settings.symbols[id].weight / totalWeight;
  const combinationOdds = { coin10: 0, coin100: 0, coin1000: 0, mixed: 0 };
  let expected = 0, hitRate = 0;
  for (const a of symbols) for (const b of symbols) for (const c of symbols) {
    const chance = probability(a) * probability(b) * probability(c);
    if ([a, b, c].includes(BLANK)) continue;
    const id = a === b && b === c ? a : 'mixed';
    combinationOdds[id] += chance;
    const pay = settings.payouts[id];
    assert.equal(lineWin([a, b, c], 10, settings.payouts), pay * 10);
    expected += chance * pay;
    if (pay) hitRate += chance;
  }
  const odds = returnOdds(settings);
  assert.ok(Math.abs(odds.expected - expected) < 1e-12);
  assert.ok(Math.abs(odds.hitRate - hitRate) < 1e-12);
  for (const { id, probability } of odds.wins) {
    assert.ok(Math.abs(probability - combinationOdds[id]) < 1e-12);
  }
});

test('simulation counts each combination and excludes zero pays from paid hits', async () => {
  const settings = config();
  settings.payouts.coin1000 = 0;
  const odds = returnOdds(settings);
  let start = 0;
  const rolls = odds.wins.map(({ probability }) => {
    const roll = start + probability / 2;
    start += probability;
    return roll;
  });
  rolls.push(.99);
  const result = await simulate(odds, rolls.length, { rng: () => rolls.shift() });
  assert.deepEqual(result.combinations, odds.wins.map(({ id }) => ({ id, count: 1, frequency: .2 })));
  assert.equal(result.hitRate, .6);
  assert.equal(result.rtp, 23);
});

test('simulation runs one million spins and can be cancelled', async () => {
  const settings = config();
  settings.symbols.coin100.weight = settings.symbols.coin1000.weight = 0;
  const odds = returnOdds(settings);
  let seed = 101;
  const rng = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const result = await simulate(odds, 1000000, { rng });
  assert.ok(Math.abs(result.rtp - 1.25) < .025);
  assert.ok(Math.abs(result.hitRate - .125) < .002);
  const run = new AbortController();
  const cancelled = simulate(odds, 1000000, { signal: run.signal });
  run.abort();
  assert.equal(await cancelled, null);
});

test('the editor posts exact RTP before the simulation and restores its controls', async () => {
  const fields = {
    'sim-count': { valueAsNumber: MAX_SPINS + 1 }, 'run-rtp': {}, 'cancel-rtp': {}, 'rtp-result': {}
  };
  const editor = Object.create(Editor.prototype);
  editor.s = config();
  editor.el = { querySelector: selector => fields[selector.slice(1)] };
  const run = editor.runRtp();
  assert.match(fields['rtp-result'].textContent, /Expected RTP.*%/);
  assert.equal(fields['run-rtp'].disabled, true);
  await run;
  assert.match(fields['rtp-result'].textContent, /20,000,000 spins/);
  assert.match(fields['rtp-result'].textContent, /Simulated RTP.*%/);
  assert.equal(fields['run-rtp'].disabled, false);
  const another = editor.runRtp();
  editor.cancelRtp();
  await another;
  assert.equal(fields['rtp-result'].textContent, 'Simulation cancelled.');
});

test('wins map to four distinct cues and blanks remain silent', () => {
  const winningLines = [[ten, ten, ten], [hundred, hundred, hundred], [thousand, thousand, thousand], [ten, hundred, ten]];
  const cues = winningLines.map(ids => WIN_CUES[winCombination(ids)]);
  assert.deepEqual(cues, ['win10', 'win100', 'win1000', 'winMixed']);
  assert.equal(WIN_CUES[winCombination([ten, BLANK, ten])], undefined);
});

test('the title art fits portrait and wide screens and closes after Play', async () => {
  const previous = { window: globalThis.window, document: globalThis.document };
  const area = { width: 390, height: 844 };
  const classes = new Set();
  const el = {
    getBoundingClientRect: () => area,
    classList: { add: name => classes.add(name), contains: name => classes.has(name) },
    style: { setProperty() {} },
    addEventListener(type, callback, options) {
      assert.equal(type, 'click');
      assert.equal(options.once, true);
      this.play = callback;
    }
  };
  const scene = { style: {} };
  const art = { naturalWidth: 1280, naturalHeight: 720, classList: el.classList, async decode() {} };
  const status = { style: {} };
  const prompt = { style: {}, hidden: true };
  const elements = { '#boot': el, '#boot-scene': scene, '#boot-art': art, '#boot-status': status, '#start': prompt };
  try {
    globalThis.document = { baseURI: 'http://localhost/', querySelector: id => elements[id] };
    globalThis.window = { addEventListener() {} };
    const settings = config();
    settings.startup.fadeDuration = 0;
    const startup = new Startup(settings);
    await startup.load();
    assert.match(art.src, /\/assets\/title-screen\.jpeg\?/);
    assert.ok(classes.has('boot-art-ready'));
    assert.equal(scene.style.width, '390px');
    assert.equal(scene.style.height, '219.375px');
    Object.assign(area, { width: 1600, height: 720 });
    startup.apply();
    assert.equal(scene.style.width, '1280px');
    assert.equal(scene.style.height, '720px');
    startup.ready(() => startup.close());
    assert.equal(prompt.hidden, false);
    await el.play();
    assert.ok(classes.has('boot-fade'));
    assert.equal(el.inert, true);
    assert.equal(el.hidden, true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('imported FPS controls cannot restore a render cap', () => {
  const settings = mergeSettings({ performance: { nativeRefresh: false, maxFPS: 15, mobileResolution: .75 } });
  assert.equal('nativeRefresh' in settings.performance, false);
  assert.equal('maxFPS' in settings.performance, false);
  assert.deepEqual(renderProfile(settings, true), { resolution: .75, textResolution: 2 });
});

test('featured win tracks follow the SFX switch and volume independently of music', () => {
  const settings = config();
  const audio = new AudioSystem(() => settings);
  audio.ctx = { state: 'running' };
  audio.started = true;
  audio.preferences = { sfx: true, music: false, sfxLevel: .5, musicLevel: .75 };
  let playing;
  audio.startStream = (kind, gain) => { playing = { kind, gain }; };
  audio.setMode('base');
  assert.deepEqual(playing, { kind: 'music', gain: 0 });
  for (const [mode, file] of [['bigWin', 'bigWinMusic'], ['jackpot', 'jackpotMusic']]) {
    settings.audio.musicEnabled = false;
    audio.setMode(mode);
    assert.deepEqual(playing, { kind: file, gain: settings.audio.sfxVolume * settings.audio[file + 'Volume'] * .5 });
  }
  audio.setLevel('sfx', .25);
  assert.equal(playing.gain, settings.audio.sfxVolume * settings.audio.jackpotMusicVolume * .25);
  audio.setPreference('music', true);
  audio.setPreference('sfx', false);
  assert.equal(playing.gain, 0);
  settings.audio.musicEnabled = true;
  audio.setMode('base');
  assert.deepEqual(playing, { kind: 'music', gain: settings.audio.musicVolume * .75 });
});

test('featured wins can finish early or count for ten seconds and require a separate claim', async () => {
  const realPerformance = globalThis.performance;
  const realPixi = globalThis.PIXI;
  const realDocument = globalThis.document;
  let now = 0, focused = false;
  const point = { set() {} };
  class Container {
    children = [];
    position = point;
    scale = { set() {} };
    addChild(child) { this.children.push(child); return child; }
    destroy() { this.destroyed = true; }
  }
  class Sprite extends Container {
    constructor(texture) {
      super();
      Object.assign(this, { texture, anchor: point });
    }
  }
  class Graphics extends Container {
    beginFill() { return this; }
    drawRect() { return this; }
    drawPolygon() { return this; }
    clear() { return this; }
    lineStyle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    endFill() { return this; }
  }
  try {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
    globalThis.PIXI = { Container, Sprite, Graphics };
    globalThis.document = { activeElement: { focus() { focused = true; } } };
    for (const [id, name, music, skip] of [[hundred, 'BIG WIN', 'bigWin', true], [thousand, 'JACKPOT WIN!!!', 'jackpot', false]]) {
      now = 0;
      focused = false;
      const callbacks = new Set();
      const ticker = { add: callback => callbacks.add(callback), remove: callback => callbacks.delete(callback) };
      const step = time => { now = time; for (const callback of [...callbacks]) callback(); };
      const stage = new Container();
      const texture = { width: 226, height: 232 };
      const render = { app: { stage, ticker }, textures: { [id]: texture }, mobile: false };
      const modes = [];
      const audio = { setMode: mode => modes.push(mode) };
      const button = { focus() {}, setAttribute() {} };
      const elements = {
        button, '#featured-win-title': {}, '#featured-win-amount': {},
        '#featured-win-total': {}
      };
      const node = { dataset: {}, style: {}, hidden: true, querySelector: selector => elements[selector] };
      const value = elements['#featured-win-amount'];
      const result = playWinCelebration(render, audio, node, id, 10000, String);
      assert.equal(node.hidden, false);
      assert.equal(elements['#featured-win-title'].textContent, name);
      const coins = stage.children[0].children.slice(1);
      assert.ok(coins.every(coin => coin.children[1].texture === texture));
      step(skip ? 120 : WIN_COUNT_MS - 1);
      assert.ok(Number(value.textContent) < 10000);
      assert.deepEqual(modes, [music]);
      if (skip) {
        const flying = coins.filter(coin => coin.visible);
        assert.ok(flying.length > 0);
        button.onclick();
        step(275);
        assert.deepEqual(coins.filter(coin => coin.visible), flying);
      }
      else step(WIN_COUNT_MS);
      assert.equal(value.textContent, '10000');
      assert.deepEqual(modes, [music, 'winHold']);
      assert.equal(button.disabled, false);
      assert.equal(node.hidden, false);
      button.onclick();
      await Promise.resolve();
      step(WIN_COUNT_MS + 2000);
      await result;
      assert.equal(node.hidden, true);
      assert.equal(stage.children[0].destroyed, true);
      assert.equal(callbacks.size, 0);
      assert.equal(focused, true);
    }
  } finally {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: realPerformance });
    if (realPixi === undefined) delete globalThis.PIXI;
    else globalThis.PIXI = realPixi;
    if (realDocument === undefined) delete globalThis.document;
    else globalThis.document = realDocument;
  }
});

test('cabinet shake follows the bell and restores the cabinet transform', async () => {
  const configShake = config().winShake;
  const callbacks = new Set();
  const ticker = { add: callback => callbacks.add(callback), remove: callback => callbacks.delete(callback) };
  const position = { x: 512, y: 510, set(x, y) { this.x = x; this.y = y; } };
  const slot = { position, rotation: .1 };
  let finishBell;
  const done = new Promise(resolve => { finishBell = resolve; });
  const result = shakeCabinet({ slot, app: { ticker } }, { ...configShake, duration: 0 },
    { audible: true, duration: 2.6, done });
  assert.equal(callbacks.size, 1);
  for (const callback of callbacks) callback();
  finishBell();
  await result;
  assert.equal(callbacks.size, 0);
  assert.equal(position.x, 512);
  assert.equal(position.y, 510);
  assert.equal(slot.rotation, .1);
});

test('submenu fitting uses natural content height and scales tall content to fit', () => {
  const properties = new Map();
  const ui = {
    modal: { kind: 'volume' },
    menuConfig: () => defaults.popups.volume,
    content: { offsetHeight: 290, offsetWidth: 730, style: { setProperty: (key, value) => properties.set(key, value) } }
  };
  UI.prototype.fitMenu.call(ui);
  assert.equal(properties.get('--panel-scale'), 1);
  ui.content.offsetHeight = 800;
  UI.prototype.fitMenu.call(ui);
  assert.equal(properties.get('--panel-scale'), 550 / 800);
});

test('the reel-loop voice ends at its scheduled contact and mute cleans it up', async () => {
  const settings = config();
  const audio = new AudioSystem(() => settings);
  const node = { connect() {}, disconnect() {} };
  let source;
  audio.ctx = {
    currentTime: 10,
    state: 'running',
    createGain: () => ({ ...node, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } }),
    createBufferSource: () => (source = {
      ...node,
      playbackRate: { value: 1 },
      start(when) { this.startAt = when; },
      stop(when) { this.stopAt = when; }
    })
  };
  audio.buffers.reelLoop = { duration: .9 };
  audio.buffers.land100 = { duration: .25 };
  const land = audio.play('land100', { rate: 1.5 });
  assert.equal(land.duration, .25 / 1.5);
  assert.equal(land.source.playbackRate.value, 1.5);
  settings.audio.reelLoopTimingMs = 100;
  const loop = audio.play('reelLoop', { loopForMs: 2000 });
  assert.equal(source.loop, true);
  assert.equal(source.startAt, 10.1);
  assert.equal(source.stopAt, 12);
  assert.ok(audio.voices.has(loop));
  audio.setPreference('sfx', false);
  await loop.done;
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.play('reelLoop', { loopForMs: 1000 }).audible, false);
});

test('shipped and exported settings round-trip, including mask position and symbol weights', async () => {
  const file = JSON.parse(await readFile(new URL('../current-settings.json', import.meta.url), 'utf8'));
  assert.deepEqual(mergeSettings(file), defaults);
  const input = config();
  updateLayoutField(input, 'buttons.spin.x', 55);
  input.masks.spin.y = 372;
  input.symbols.coin1000.weight = .07;
  input.reels.blankPercent = 27.3;
  input.payouts = { coin10: 7.3, coin100: 100, coin1000: 0, mixed: 2.5 };
  const saved = mergeSettings(JSON.parse(JSON.stringify(input)));
  assert.equal(saved.buttons.spin.x, 55);
  assert.equal(saved.masks.spin.x, 55);
  assert.equal(saved.masks.spin.y, 372);
  assert.equal(saved.symbols.coin1000.weight, .07);
  assert.equal(saved.reels.blankPercent, 27.3);
  assert.deepEqual(saved.payouts, input.payouts);
});

test('credits, debt and score survive a reload, with reference cash-out and debt rules', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const player = loadPlayer();
  assert.equal(player.credits, 1000);
  assert.equal(player.bet, 10);
  assert.throws(() => cashOut(player, 'Tester'), /minimum|requires/i);
  borrow(player, 3000);
  savePlayer(player);
  const loaded = loadPlayer();
  assert.equal(loaded.credits, 4000);
  assert.equal(loaded.debt, 3000);
  assert.throws(() => cashOut(loaded, 'Tester'), /repay/i);
  repay(loaded, 3000);
  loaded.credits = 6000;
  assert.equal(cashOut(loaded, 'Tester').score, 6000);
  const after = loadPlayer();
  assert.equal(after.credits, 1000);
  assert.equal(after.debt, 0);
  assert.equal(listScores(after, 5)[0].name, 'Tester');
  refreshDebt(after, undefined, after.debtStartedAt + 30 * DAY_MS);
  assert.equal(after.hadDebt, false);
  delete globalThis.localStorage;
});
