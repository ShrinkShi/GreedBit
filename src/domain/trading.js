/* GreedBit pure trading math (no DOM, no globals besides the exported namespace).
 * Loaded as a classic script in the browser (window.GreedBitDomain) and as CommonJS in tests.
 * Keep every function deterministic: no Date, no Math.random, no storage access.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GreedBitDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MMR = 0.005;
  /* Keep the cap clearly below 1/MMR (200X): at exactly 1/MMR the isolated liquidation
   * price collapses onto the entry price and every tick liquidates the position. */
  const MAX_LEVERAGE = 100;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  /* Gross PnL of a position (before fees). qty is the contract/base quantity. */
  function positionPnl(side, entry, mark, qty) {
    const dir = side === 'long' ? 1 : -1;
    return (Number(mark) - Number(entry)) * Number(qty) * dir;
  }

  /* Liquidation price.
   * cushionUsdt = position margin (+ available balance for cross mode).
   * Mirrors the original inline formula: ratio = min(0.95, cushion / max(1, notional)).
   */
  function liqPrice(input) {
    const src = input || {};
    const side = src.side;
    const entry = Number(src.entry);
    const notional = Number(src.notional);
    const cushionUsdt = Number(src.cushionUsdt);
    const mmr = Number.isFinite(Number(src.mmr)) ? Number(src.mmr) : MMR;
    if (!Number.isFinite(entry) || entry <= 0) return 0;
    if (!Number.isFinite(notional) || !Number.isFinite(cushionUsdt)) return 0;
    const ratio = Math.min(0.95, cushionUsdt / Math.max(1, notional));
    if (side === 'long') return Math.max(0.0000001, entry * (1 - ratio + mmr));
    return entry * (1 + ratio - mmr);
  }

  /* Liquidation price for a cross-margin position.
   * Account equity is shared, so every position must NOT add the same available balance as
   * its own cushion (the old inline formula did exactly that). Instead solve for the price P
   * where: equity + PnL_i(P) - MMR * (notional_i(P) + otherNotional) = 0.
   *   long : P = (mark*qty - equity + MMR*other) / (qty*(1-MMR))
   *   short: P = (equity + mark*qty - MMR*other) / (qty*(1+MMR))
   * Returns 0 when the result is non-positive (never liquidatable by price alone).
   */
  function crossLiqPrice(input) {
    const src = input || {};
    const side = src.side;
    const mark = Number(src.mark);
    const qty = Number(src.qty);
    const equity = Number(src.equity);
    const otherNotional = Number(src.otherNotional) || 0;
    const mmr = Number.isFinite(Number(src.mmr)) ? Number(src.mmr) : MMR;
    if (!(mark > 0) || !(qty > 0) || !Number.isFinite(equity)) return 0;
    const maintenance = mmr * otherNotional;
    const numerator = side === 'long'
      ? mark * qty - equity + maintenance
      : equity + mark * qty - maintenance;
    const denominator = qty * (side === 'long' ? 1 - mmr : 1 + mmr);
    if (!(denominator > 0)) return 0;
    return Math.max(0, numerator / denominator);
  }

  /* Settlement of a full or partial close.
   * gross      : price PnL before fees
   * realized   : net result (gross - open fee share - close fee)
   * cashDelta  : change of the available balance, excluding the released margin
   * Fees must already be USDT-denominated; callers decide how to charge GREED discounts.
   */
  function settleClose(input) {
    const gross = positionPnl(input && input.side, input && input.entry, input && input.fill, input && input.qty);
    const openFee = Number(input && input.openFee) || 0;
    const closeFee = Number(input && input.closeFee) || 0;
    return {
      gross,
      openFee,
      closeFee,
      realized: gross - openFee - closeFee,
      cashDelta: gross - closeFee
    };
  }

  /* Funding payment for one position. Positive = credited, negative = debited.
   * Positive rate: longs pay shorts.
   */
  function fundingPayment(input) {
    const side = input && input.side;
    const qty = Number(input && input.qty);
    const mark = Number(input && input.mark);
    const rate = Number(input && input.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(mark) || !Number.isFinite(rate)) return 0;
    return qty * mark * rate * (side === 'long' ? -1 : 1);
  }

  /* Notional of a position. */
  function notionalOf(entry, qty) { return Number(entry) * Number(qty); }

  return { MMR, MAX_LEVERAGE, clamp, positionPnl, liqPrice, crossLiqPrice, settleClose, fundingPayment, notionalOf };
});
