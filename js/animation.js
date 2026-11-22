import { BLANK } from './math.js';
import { cell, centerIds, coinPicker } from './outcomes.js';

// ZEUS1 updates motion at high ticker priority before Pixi renders.
export function animate(ms, frame, ticker = null) {
  if (ms <= 0) {
    frame(1);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      const progress = Math.min(1, (performance.now() - start) / ms);
      try { frame(progress); }
      catch (error) {
        ticker?.remove(tick);
        reject(error);
        return;
      }
      if (progress >= 1) {
        ticker?.remove(tick);
        resolve();
      } else if (!ticker) requestAnimationFrame(tick);
    };
    if (ticker) ticker.add(tick, null, 50);
    else requestAnimationFrame(tick);
  });
}

export const easeOut = p => 1 - (1 - p) ** 3;

// ZEUS1's integrated acceleration, cruise and deceleration curve.
export function trajectory(t, T, a, d, target) {
  t = Math.min(t, T);
  let integral;
  if (a > 0 && t < a) integral = t * t / (2 * a);
  else if (t < T - d || !d) integral = t - a / 2;
  else {
    const z = t - (T - d);
    integral = T - d - a / 2 + z - z * z / (2 * d);
  }
  return target * integral / (T - (a + d) / 2);
}

// Compute the contact schedule before reels move. Each chase starts when its
// qualifying center symbols contact the payline.
export function planSpin(ids, settings) {
  const spin = settings.spin;
  const ant = settings.anticipation;
  const base = Math.max(300, spin.duration);
  const stagger = Math.max(20, spin.stagger);
  const times = [base, base + stagger, base + stagger * 2];
  const slow = [false, false, false];
  const phases = [];
  if (!ant.enabled) return { times, slow, phases };
  const extra = ant.extraDuration;
  if (ids[0] === 'coin1000') {
    times[1] += extra;
    times[2] = times[1] + stagger;
    slow[1] = true;
    phases.push({ start: times[0], end: times[1], reels: [1, 2] });
    if (ids[1] === 'coin1000') {
      times[2] += Math.max(ant.rightExtraDuration, ant.stopDuration);
      slow[2] = true;
      phases.push({ start: times[1], end: times[2], reels: [2] });
    }
  } else if (ids[0] !== BLANK && ids[0] === ids[1]) {
    times[2] += Math.max(extra, ant.stopDuration);
    slow[2] = true;
    phases.push({ start: times[1], end: times[2], reels: [2] });
  }
  return { times, slow, phases };
}

export function motionStrip(old, next, previous, steps, pick) {
  // Row 1 is the payline. Choose travel parity to join the original strip
  // and the scheduled stop without ever placing two coins side by side.
  const oldBlank = old[1].id === BLANK;
  const newBlank = next[1].id === BLANK;
  if (Boolean(steps % 2) !== (oldBlank !== newBlank)) steps++;
  const strip = {};
  const blankParity = oldBlank ? 1 : 0;
  for (let index = -steps - 12; index <= 12; index++) {
    const parity = ((index % 2) + 2) % 2;
    strip[index] = parity === blankParity ? cell() : cell(pick());
  }
  old.forEach((symbol, row) => { strip[row] = symbol; });
  if (previous) {
    strip[-1] = previous.top;
    strip[3] = previous.bottom;
    for (const [key, symbol] of Object.entries(previous.extra ?? {})) strip[key] = symbol;
  }
  next.forEach((symbol, row) => { strip[row - steps] = symbol; });
  const extra = {};
  for (let row = -3; row <= 5; row++) {
    if ((row < -1 || row > 3) && strip[row - steps]) extra[row] = strip[row - steps];
  }
  return { steps, strip, adjacent: { top: strip[-steps - 1], bottom: strip[3 - steps], extra } };
}

export async function spinReels(render, old, outcome, settings, audio, peeks = []) {
  const cfg = settings.spin;
  const spacing = render.geometry.spacing;
  const pick = coinPicker(settings);
  const plan = planSpin(centerIds(outcome), settings);
  const motions = outcome.map((column, reel) => {
    const T = plan.times[reel], a = Math.min(cfg.startDuration, T * .3);
    const anticipationStart = plan.phases.find(phase => phase.reels.includes(reel))?.start ?? 0;
    const allowed = plan.slow[reel] ? Math.min(T * .68, T - anticipationStart) : T * .5;
    const d = Math.min(plan.slow[reel] ? Math.max(cfg.stopDuration, settings.anticipation.stopDuration) : cfg.stopDuration, allowed);
    const desired = Math.max(8, Math.round(cfg.speed * (T - (a + d) / 2) / 1000));
    const motion = motionStrip(old[reel], column, peeks[reel], desired, pick);
    return { ...motion, T, a, d, target: motion.steps * spacing, contacted: false, earlyStop: null };
  });

  render.beginSpin(motions);
  const phaseStarts = [...new Set(plan.phases.map(phase => phase.start))]
    .filter(start => !plan.phases.some(phase => phase.end === start))
    .map(start => ({ start, cue: audio.advance('anticipate', start), played: false }));
  const max = Math.max(...plan.times) + cfg.bounceDuration;
  motions.forEach(motion => { motion.earlyStop = audio.advance('stop', motion.T); });

  try {
    await animate(max, progress => {
      const elapsed = max * progress;
      motions.forEach((motion, reel) => {
        if (elapsed < motion.T) {
          render.spinFrame(reel, trajectory(elapsed, motion.T, motion.a, motion.d, motion.target), motion);
          return;
        }
        if (!motion.contacted) {
          motion.contacted = true;
          if (!motion.earlyStop) audio.play('stop');
          render.startLanding(reel, outcome[reel][1]);
        }
        const settle = Math.min(1, (elapsed - motion.T) / Math.max(1, cfg.bounceDuration));
        const bounce = Math.sin(settle * Math.PI * cfg.bounceCycles) * cfg.bounce * (1 - settle);
        render.landReel(reel, outcome[reel], motion.adjacent, bounce);
      });
      for (const phase of phaseStarts) {
        if (!phase.played && elapsed >= phase.start) {
          phase.played = true;
          if (!phase.cue) audio.play('anticipate');
        }
      }
      const active = plan.phases.find(phase => elapsed >= phase.start && elapsed < phase.end);
      if (!active && render.chase.active.length) audio.stopAnticipation();
      render.setAnticipation(active?.reels ?? []);
    }, render.app.ticker);
  } finally {
    phaseStarts.forEach(phase => phase.cue?.cancel());
    audio.stopAnticipation();
    render.setAnticipation([]);
  }
  const adjacent = motions.map(motion => motion.adjacent);
  render.endSpin(outcome, adjacent);
  return adjacent;
}

export async function popupIn(container, config) {
  await animate(config.inDuration, p => {
    if (container.destroyed) return;
    container.alpha = (config.alpha ?? 1) * p;
    container.scale.set(config.scale * (.90 + .10 * easeOut(p)));
  });
}
export async function popupOut(container, config) {
  await animate(config.outDuration, p => {
    if (container.destroyed) return;
    container.alpha = (config.alpha ?? 1) * (1 - p);
    container.scale.set(config.scale * (1 + .03 * p));
  });
}
