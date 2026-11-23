import { BLANK, COINS } from './math.js';

export function coinWeights(settings) {
  const weights = COINS.map(id => settings.symbols[id].weight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) throw Error('Keep at least one coin weight above zero.');
  return weights.map(weight => weight / total);
}

export function coinPicker(settings, rng = Math.random) {
  const [ten, hundred, thousand] = coinWeights(settings);
  const second = ten + hundred;
  return () => {
    const roll = rng();
    return roll < ten ? COINS[0] : roll < second || thousand === 0 ? COINS[1] : COINS[2];
  };
}

export const blankChance = settings => (settings.reels?.blankPercent ?? 50) / 100;
export const centerStop = (pickCoin, chance, rng = Math.random) => rng() < chance ? BLANK : pickCoin();
export const cell = (id = BLANK) => ({ id });

export function reelColumn(id, pickCoin) {
  return id === BLANK ? [cell(pickCoin()), cell(), cell(pickCoin())] : [cell(), cell(id), cell()];
}

export function baseOutcome(settings, forcedIds, rng = Math.random) {
  const pick = coinPicker(settings, rng);
  const chance = blankChance(settings);
  return Array.from({ length: 3 }, (_, reel) => reelColumn(forcedIds?.[reel] ?? centerStop(pick, chance, rng), pick));
}

export const centerIds = board => board.map(column => column[1].id);
