import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { motionStrip, planSpin, spinReels, trajectory } from '../js/animation.js';
import { COINS, BLANK, lineWin, borrow, repay } from '../js/math.js';
import { exactReturn, simulate } from '../js/simulation.js';
import { baseOutcome, centerStop, coinPicker, reelColumn } from '../js/outcomes.js';
import { cashOut, listScores, loadPlayer, savePlayer } from '../js/storage.js';
import { DAY_MS, refreshDebt } from '../js/debt.js';
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
  assert.deepEqual(miss.phases, [{ start: miss.times[0], end: miss.times[1], reels: [1, 2] }]);
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
    const next = baseOutcome(settings, [thousand, thousand, BLANK]);
    const ticks = new Set(), cues = [], landings = [], anticipation = [];
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
    const audio = { advance() {}, play: cue => cues.push(cue), stopAnticipation() {} };
    const result = spinReels(render, old, next, settings, audio);
    for (; now <= 6000; now += 16) for (const tick of ticks) tick();
    const peeks = await result;
    assert.deepEqual(landings, [[0, thousand], [1, thousand], [2, BLANK]]);
    assert.deepEqual(cues, ['stop', 'anticipate', 'stop', 'stop']);
    assert.ok(anticipation.includes('1,2') && anticipation.includes('2'));
    assert.deepEqual(render.chase.active, []);
    assert.equal(peeks.length, 3);
  } finally {
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: realPerformance });
  }
});

test('RTP uses the game weights, blank probability and pay rules', () => {
  const settings = config();
  settings.symbols.coin100.weight = settings.symbols.coin1000.weight = 0;
  assert.equal(exactReturn(settings, lineWin), 1.25);
  let seed = 101;
  const rng = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const result = simulate(settings, 100000, coinPicker, centerStop, lineWin, rng);
  assert.ok(Math.abs(result.rtp - 1.25) < .05);
});

test('shipped and exported settings round-trip, including mask position and symbol weights', async () => {
  const file = JSON.parse(await readFile(new URL('../current-settings.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, defaults);
  assert.deepEqual(mergeSettings(file), defaults);
  const input = config();
  updateLayoutField(input, 'buttons.spin.x', 55);
  input.masks.spin.y = 372;
  input.symbols.coin1000.weight = .07;
  const saved = mergeSettings(JSON.parse(JSON.stringify(input)));
  assert.equal(saved.buttons.spin.x, 55);
  assert.equal(saved.masks.spin.x, 55);
  assert.equal(saved.masks.spin.y, 372);
  assert.equal(saved.symbols.coin1000.weight, .07);
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
