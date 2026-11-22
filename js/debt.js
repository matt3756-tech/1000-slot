export const DEBT_RULES={noDebtMinimum:10000,borrowedMinimum:5000,resetDays:30};
export const DAY_MS=86400000;
// The first borrow starts a fixed period. Repayments and cash-outs do not erase its history.
export function refreshDebt(player,rules=DEBT_RULES,now=Date.now()){
 const before=JSON.stringify([player.debt,player.hadDebt,player.debtStartedAt]);
 player.hadDebt=player.hadDebt===true||player.debt>0;
 if(player.hadDebt&&(!Number.isFinite(player.debtStartedAt)||player.debtStartedAt<=0))player.debtStartedAt=now;
 if(player.debtStartedAt>0&&now>=player.debtStartedAt+rules.resetDays*DAY_MS){player.debt=0;player.hadDebt=false;player.debtStartedAt=0;}
 if(!player.hadDebt)player.debtStartedAt=0;
 return before!==JSON.stringify([player.debt,player.hadDebt,player.debtStartedAt]);
}
export function recordBorrow(player,rules=DEBT_RULES,now=Date.now()){
 refreshDebt(player,rules,now);if(!player.hadDebt)player.debtStartedAt=now;player.hadDebt=true;
}
export function cashoutEligibility(player,rules=DEBT_RULES){
 const minimum=player.hadDebt||player.debt>0?rules.borrowedMinimum:rules.noDebtMinimum;
 const allowed=player.debt===0&&player.credits>=minimum;
 return{minimum,allowed,reason:player.debt>0?'Repay all debt before cashing out.':player.credits<minimum?`Cash out requires at least ${minimum.toLocaleString('en-US')} credits.`:''};
}
export const debtResetAt=(player,rules=DEBT_RULES)=>player.debtStartedAt>0?player.debtStartedAt+rules.resetDays*DAY_MS:0;
