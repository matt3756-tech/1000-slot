import { BLANK, COINS } from './math.js';

export function exactReturn(settings, payout) {
  const totalWeight = COINS.reduce((sum, id) => sum + settings.symbols[id].weight, 0);
  const probabilities = COINS.map(id => [id, .5 * settings.symbols[id].weight / totalWeight]);
  let returned = 0;
  for (const [a, pa] of probabilities) {
    for (const [b, pb] of probabilities) {
      for (const [c, pc] of probabilities) returned += pa * pb * pc * payout([a, b, c], 1);
    }
  }
  return returned;
}

export function simulate(settings, spins, pick, stop, payout, rng = Math.random) {
  const pickCoin = pick(settings, rng);
  let total = 0, wins = 0, triples = 0, blanks = 0;
  for (let i = 0; i < spins; i++) {
    const ids = [stop(pickCoin, rng), stop(pickCoin, rng), stop(pickCoin, rng)];
    const amount = payout(ids, 1);
    total += amount;
    if (amount) wins++;
    if (ids[0] !== BLANK && ids.every(id => id === ids[0])) triples++;
    if (ids.includes(BLANK)) blanks++;
  }
  return { rtp: total / spins, hitRate: wins / spins, triples, blanks };
}
