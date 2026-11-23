import { recordBorrow, refreshDebt, DEBT_RULES } from './debt.js';

export const COINS = ['coin10', 'coin100', 'coin1000'];
export const PAY_MULTIPLIERS = { coin10: 10, coin100: 100, coin1000: 1000, mixed: 5 };
export const WIN_LABELS = { coin10: '3 × 10', coin100: '3 × 100', coin1000: '3 × 1000', mixed: 'Any mix' };
export const BLANK = 'blank';

export function winCombination(ids) {
  if (ids.length !== 3 || !ids.every(id => COINS.includes(id))) return null;
  return ids.every(id => id === ids[0]) ? ids[0] : 'mixed';
}

export function lineWin(ids, bet, payouts = PAY_MULTIPLIERS) {
  return payoutCredits(bet, payouts[winCombination(ids)] ?? 0);
}

export const payoutCredits = (bet, multiplier) => Math.round(multiplier * 10) * bet / 10;

export function borrow(player, amount, rules = DEBT_RULES) {
  if (!Number.isInteger(amount) || amount < 1000 || amount > 10000 || amount % 1000 !== 0) {
    throw Error('Choose a rebuy from 1,000 to 10,000 credits.');
  }
  recordBorrow(player, rules);
  player.credits += amount;
  player.debt += amount;
}

export function repay(player, amount, rules = DEBT_RULES) {
  refreshDebt(player, rules);
  if (!Number.isInteger(amount) || amount < 1000 || amount % 1000 || amount > player.credits || amount > player.debt) {
    throw Error('Choose a repayment covered by both credits and debt.');
  }
  player.credits -= amount;
  player.debt -= amount;
}
