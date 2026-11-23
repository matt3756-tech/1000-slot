import { returnOdds, simulate, simulationCount } from './simulation.js';

self.onmessage = async ({ data: { settings, count } }) => {
  try {
    const spins = simulationCount(count);
    const odds = returnOdds(settings);
    const report = await simulate(odds, spins);
    self.postMessage({ ...report, spins, expected: odds.expected });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
