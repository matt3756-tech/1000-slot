const query = new URL(import.meta.url).search;
const [{ exactReturn, simulate }, { lineWin }, { coinPicker, centerStop }] = await Promise.all([
  import('./simulation.js' + query), import('./math.js' + query), import('./outcomes.js' + query)
]);
self.onmessage = ({ data: { settings, count } }) => {
  try {
    const spins = Math.round(Math.min(1000000, Math.max(1000, Number(count) || 100000)));
    const report = simulate(settings, spins, coinPicker, centerStop, lineWin);
    self.postMessage({ ...report, spins, expected: exactReturn(settings, lineWin) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
