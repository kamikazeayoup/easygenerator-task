import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedWindowCounter } from '../dist/auth/services/fixed-window-counter.js';

test('each successful request can release only its own email reservation', () => {
  const counter = new FixedWindowCounter(2, 5_000, 10, () => 0);
  const failed = counter.reserve('same@example.com');
  const successful = counter.reserve('same@example.com');
  assert.equal(typeof failed.release, 'function');
  assert.deepEqual(counter.reserve('same@example.com'), { retryAfterMs: 5_000 });
  successful.release();
  successful.release();
  assert.equal(typeof counter.reserve('same@example.com').release, 'function');
  assert.deepEqual(counter.reserve('same@example.com'), { retryAfterMs: 5_000 });
});

test('blocked retries do not extend a window and stale releases leave a new window intact', () => {
  let now = 0;
  const counter = new FixedWindowCounter(1, 5_000, 10, () => now);
  const expired = counter.reserve('email');
  now = 1_000;
  assert.deepEqual(counter.reserve('email'), { retryAfterMs: 4_000 });
  now = 4_999;
  assert.deepEqual(counter.reserve('email'), { retryAfterMs: 1 });
  now = 5_000;
  assert.equal(typeof counter.reserve('email').release, 'function');
  expired.release();
  assert.deepEqual(counter.reserve('email'), { retryAfterMs: 5_000 });
});

test('at capacity, new identifiers wait without evicting active abuse counters', () => {
  let now = 0;
  const counter = new FixedWindowCounter(1, 5_000, 2, () => now);
  counter.reserve('a');
  now = 1_000;
  counter.reserve('b');
  assert.deepEqual(counter.reserve('new'), { retryAfterMs: 4_000 });
  assert.deepEqual(counter.reserve('b'), { retryAfterMs: 5_000 });
  now = 5_000;
  assert.equal(typeof counter.reserve('new').release, 'function');
  assert.deepEqual(counter.reserve('b'), { retryAfterMs: 1_000 });
});
