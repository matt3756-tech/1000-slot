import { COINS, PAY_MULTIPLIERS } from './math.js';
import { blankChance, coinWeights } from './outcomes.js';

export const MIN_SPINS = 1000;
export const MAX_SPINS = 20000000;
export const DEFAULT_SPINS = 100000;
export const simulationCount = (value, fallback = DEFAULT_SPINS) =>
  Math.round(Math.min(MAX_SPINS, Math.max(MIN_SPINS, Number(value) || fallback)));

// All three reels use the same independent center-stop distribution.
export function returnOdds(settings) {
  const weights = coinWeights(settings);
  const payouts = settings.payouts ?? PAY_MULTIPLIERS;
  const allCoins = (1 - blankChance(settings)) ** 3;
  const wins = COINS.map((id, index) => ({
    id,
    probability: allCoins * weights[index] ** 3,
    payout: payouts[id]
  }));
  const matches = wins.reduce((sum, item) => sum + item.probability, 0);
  wins.push({ id: 'mixed', probability: Math.max(0, allCoins - matches), payout: payouts.mixed });
  return {
    wins,
    hitRate: wins.reduce((sum, item) => sum + (item.payout > 0 ? item.probability : 0), 0),
    expected: wins.reduce((sum, item) => sum + item.probability * item.payout, 0)
  };
}

export async function simulate(odds, spins, { signal, rng = Math.random } = {}) {
  let edge = 0;
  const [a, b, c, d] = odds.wins.map(item => edge += item.probability);
  const counts = [0, 0, 0, 0];
  const batchSize = 100000;
  for (let start = 0; start < spins; start += batchSize) {
    // Yield before each batch so the button state can paint and cancel can run.
    await new Promise(resolve => setTimeout(resolve, 0));
    if (signal?.aborted) return null;
    const end = Math.min(spins, start + batchSize);
    for (let i = start; i < end; i++) {
      const roll = rng();
      if (roll >= d) continue;
      counts[roll < a ? 0 : roll < b ? 1 : roll < c ? 2 : 3]++;
    }
  }
  let total = 0, paidSpins = 0;
  const combinations = odds.wins.map(({ id, payout }, index) => {
    const count = counts[index];
    total += count * payout;
    if (payout > 0) paidSpins += count;
    return { id, count, frequency: count / spins };
  });
  return { rtp: total / spins, hitRate: paidSpins / spins, combinations };
}
