import { BLANK, COINS } from './math.js';

// Adapted from ZEUS1's weighted selection. A weight changes coin types;
// equal symbol and blank stops come from the alternating reel strips.
export function coinPicker(settings, rng = Math.random) {
  const entries = COINS.map(id => [id, settings.symbols[id].weight]).filter(([, weight]) => weight > 0);
  if (!entries.length) throw Error('Keep at least one coin weight above zero.');
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return () => {
    let ticket = rng() * total;
    for (const [id, weight] of entries) {
      ticket -= weight;
      if (ticket < 0) return id;
    }
    return entries.at(-1)[0];
  };
}
export const centerStop = (pickCoin, rng = Math.random) => rng() < .5 ? BLANK : pickCoin();
export const cell = (id = BLANK) => ({ id });

export function reelColumn(id, pickCoin) {
  return id === BLANK ? [cell(pickCoin()), cell(), cell(pickCoin())] : [cell(), cell(id), cell()];
}
export function baseOutcome(settings, forcedIds, rng = Math.random) {
  const pick = coinPicker(settings, rng);
  return Array.from({ length: 3 }, (_, reel) => reelColumn(forcedIds?.[reel] ?? centerStop(pick, rng), pick));
}
export const centerIds = board => board.map(column => column[1].id);
