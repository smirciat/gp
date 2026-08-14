'use strict';

/** Per-transaction caps — blocks booking numbers pasted into the Points field. */
export const MAX_AWARD_POINTS_PER_TXN = 100;
export const MAX_REDEEM_POINTS_PER_TXN = 1000;

export function normalizePoints(points) {
  return Math.floor(Number(points));
}

/**
 * @returns {{ ok: true, points: number, skipBalance?: boolean } | { ok: false, message: string }}
 */
export function validateTransactionPoints(points, awardRedeem) {
  const n = normalizePoints(points);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, message: 'points must be a positive integer.' };
  }

  if (awardRedeem === 'beginning') {
    return { ok: true, points: n, skipBalance: true };
  }

  if (awardRedeem === 'redeem') {
    if (n > MAX_REDEEM_POINTS_PER_TXN) {
      return {
        ok: false,
        message:
          'Redeem cannot exceed ' + MAX_REDEEM_POINTS_PER_TXN + ' points per transaction.'
      };
    }
    return { ok: true, points: n };
  }

  if (awardRedeem === 'award') {
    if (n > MAX_AWARD_POINTS_PER_TXN) {
      return {
        ok: false,
        message:
          'Award cannot exceed ' +
          MAX_AWARD_POINTS_PER_TXN +
          ' points per transaction (flight awards are 5).'
      };
    }
    return { ok: true, points: n };
  }

  return { ok: true, points: n, skipBalance: true };
}

/** Signed delta to apply to currentPoints (+ award, − redeem). */
export function signedBalanceDelta(awardRedeem, points) {
  const n = normalizePoints(points) || 0;
  if (awardRedeem === 'award') {
    return n;
  }
  if (awardRedeem === 'redeem') {
    return -n;
  }
  return 0;
}

/** Reverse a ledger row's effect on currentPoints (for delete). */
export function reverseBalanceDelta(awardRedeem, points) {
  return -signedBalanceDelta(awardRedeem, points);
}
