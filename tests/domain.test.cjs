'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/domain/trading.js');

const near = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);

test('liqPrice: isolated 10x long', () => {
  near(D.liqPrice({ side: 'long', entry: 100, notional: 1000, cushionUsdt: 100 }), 90.5);
});

test('liqPrice: isolated 10x short', () => {
  near(D.liqPrice({ side: 'short', entry: 100, notional: 1000, cushionUsdt: 100 }), 109.5);
});

test('liqPrice: 200x long liquidates at entry (ratio == mmr)', () => {
  near(D.liqPrice({ side: 'long', entry: 100, notional: 1000, cushionUsdt: 5 }), 100);
});

test('liqPrice: cross margin adds the available balance', () => {
  near(D.liqPrice({ side: 'long', entry: 100, notional: 1000, cushionUsdt: 300 }), 70.5);
});

test('liqPrice: cushion ratio is capped at 0.95', () => {
  near(D.liqPrice({ side: 'long', entry: 100, notional: 1000, cushionUsdt: 5000 }), 5.5);
});

test('liqPrice: sub-1-USDT notional uses a 1-USDT denominator', () => {
  near(D.liqPrice({ side: 'long', entry: 100, notional: 0.5, cushionUsdt: 0.5 }), 50.5);
});

test('liqPrice: never returns a non-positive long price', () => {
  const p = D.liqPrice({ side: 'long', entry: 1e-8, notional: 1e9, cushionUsdt: 0 });
  assert.ok(p >= 1e-7);
});

test('liqPrice: invalid input returns 0 instead of NaN', () => {
  assert.equal(D.liqPrice(null), 0);
  assert.equal(D.liqPrice({ side: 'long', entry: 0, notional: 1, cushionUsdt: 1 }), 0);
});

test('positionPnl: long and short signs', () => {
  near(D.positionPnl('long', 100, 110, 2), 20);
  near(D.positionPnl('short', 100, 110, 2), -20);
});

test('settleClose: profit is net of both fees', () => {
  const r = D.settleClose({ side: 'long', entry: 100, fill: 110, qty: 2, openFee: 1, closeFee: 0.5 });
  near(r.gross, 20);
  near(r.realized, 18.5);
  near(r.cashDelta, 19.5);
});

test('settleClose: loss is net of both fees and may exceed the margin', () => {
  const r = D.settleClose({ side: 'long', entry: 100, fill: 40, qty: 10, openFee: 6, closeFee: 4 });
  near(r.gross, -600);
  near(r.realized, -610);
  near(r.cashDelta, -604);
});

test('settleClose: realised == cashDelta - openFee (conservation)', () => {
  const cases = [
    { side: 'long', entry: 90000, fill: 91000, qty: 0.5, openFee: 6, closeFee: 5 },
    { side: 'short', entry: 2, fill: 1.8, qty: 100, openFee: 0.2, closeFee: 0.12 },
    { side: 'long', entry: 10, fill: 10, qty: 3, openFee: 0, closeFee: 0 }
  ];
  for (const c of cases) {
    const r = D.settleClose(c);
    near(r.realized, r.cashDelta - c.openFee);
  }
});

test('fundingPayment: positive rate charges longs and pays shorts', () => {
  near(D.fundingPayment({ side: 'long', qty: 2, mark: 100, rate: 0.0001 }), -0.02);
  near(D.fundingPayment({ side: 'short', qty: 2, mark: 100, rate: 0.0001 }), 0.02);
});

test('fundingPayment: negative rate reverses the direction', () => {
  near(D.fundingPayment({ side: 'long', qty: 1, mark: 50, rate: -0.0002 }), 0.01);
});

test('fundingPayment: invalid input yields 0, not NaN', () => {
  assert.equal(D.fundingPayment({ side: 'long', qty: NaN, mark: 1, rate: 1 }), 0);
});

test('notionalOf: plain product', () => {
  near(D.notionalOf(100, 2), 200);
});

test('MAX_LEVERAGE stays below 1/MMR', () => {
  assert.equal(D.MAX_LEVERAGE, 100);
  assert.ok(D.MAX_LEVERAGE < 1 / D.MMR);
});

test('crossLiqPrice: long shares the account equity', () => {
  near(D.crossLiqPrice({ side: 'long', mark: 100, qty: 1, equity: 20, otherNotional: 0 }), 80 / 0.995);
});

test('crossLiqPrice: short shares the account equity', () => {
  near(D.crossLiqPrice({ side: 'short', mark: 100, qty: 1, equity: 20, otherNotional: 0 }), 120 / 1.005);
});

test('crossLiqPrice: other positions add maintenance, not extra cushion', () => {
  near(D.crossLiqPrice({ side: 'long', mark: 100, qty: 1, equity: 20, otherNotional: 100 }), 80.5 / 0.995);
});

test('crossLiqPrice: already-underwater long returns a price above mark', () => {
  const p = D.crossLiqPrice({ side: 'long', mark: 100, qty: 1, equity: -5, otherNotional: 0 });
  assert.ok(p > 100);
});

test('crossLiqPrice: invalid input returns 0', () => {
  assert.equal(D.crossLiqPrice(null), 0);
  assert.equal(D.crossLiqPrice({ side: 'long', mark: 0, qty: 1, equity: 1 }), 0);
});

