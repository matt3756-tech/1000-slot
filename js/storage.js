import { cashoutEligibility, refreshDebt } from './debt.js';
import { BETS, defaults, START_CREDITS } from './settings.js';

const PLAYER = 'coin10s.player.v1';

const initial = () => ({ credits: START_CREDITS, debt: 0, bet: BETS[0], lastWin: 0, scores: [] });
export function loadPlayer(rules = defaults.cashoutRules) {
  let player = initial();
  try {
    let snapshot;
    try { snapshot = localStorage.getItem(PLAYER); }
    catch { snapshot = sessionStorage.getItem(PLAYER); }
    const saved = JSON.parse(snapshot);
    if (Number.isSafeInteger(saved?.credits) && saved.credits >= 0 &&
        Number.isSafeInteger(saved.debt) && saved.debt >= 0 && saved.debt % 1000 === 0) {
      player = { ...player, ...saved, bet: BETS.includes(saved.bet) ? saved.bet : BETS[0] };
      if (!Array.isArray(player.scores)) player.scores = [];
    }
    if (refreshDebt(player, rules)) savePlayer(player);
  } catch (error) { console.warn('Player save unavailable.', error); }
  return player;
}

export function savePlayer(player) {
  const snapshot = JSON.stringify(player);
  try { localStorage.setItem(PLAYER, snapshot); }
  catch (error) {
    // Embedded browsers can disable persistent storage. Keep the current tab playable.
    try { sessionStorage.setItem(PLAYER, snapshot); }
    catch { console.warn('Player balance is available in this tab only.', error); }
  }
}

export function listScores(player, maxRows) {
  return [...player.scores].sort((a, b) => b.score - a.score || a.date - b.date).slice(0, maxRows);
}

export function cashOut(player, input, rules) {
  refreshDebt(player, rules);
  const eligibility = cashoutEligibility(player, rules);
  if (!eligibility.allowed) throw Error(eligibility.reason);
  const name = String(input).trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) throw Error('Enter a name for the leaderboard.');
  const score = player.credits;
  const entry = { name, score, date: Date.now() };
  const next = { ...player, scores: listScores({ scores: [...player.scores, entry] }, 100),
    credits: START_CREDITS, debt: 0, lastWin: 0 };
  savePlayer(next);
  Object.assign(player, next);
  return entry;
}
