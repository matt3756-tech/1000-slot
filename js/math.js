import { recordBorrow, refreshDebt, DEBT_RULES } from './debt.js';

export const COINS = ['coin10', 'coin100', 'coin1000'];
export const PAY_MULTIPLIERS = { coin10: 10, coin100: 100, coin1000: 1000, mixed: 5 };
export const BLANK = 'blank';

export function lineWin(ids, bet) {
  if (ids.length !== 3 || !ids.every(id => COINS.includes(id))) return 0;
  const match = ids.every(id => id === ids[0]);
  return bet * PAY_MULTIPLIERS[match ? ids[0] : 'mixed'];
}

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
