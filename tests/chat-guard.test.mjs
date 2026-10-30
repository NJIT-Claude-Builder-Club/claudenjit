import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_LIMITS, checkConversation, createRateLimiter, isNonsense, screenMessage } from '../src/lib/chat-guard.ts';

test('flags meaningless input without catching real questions', () => {
  for (const text of ['sdfghjkl', 'qwrtz zxcvbn', '!!!!!!!!!!', '???', 'aaaaaaaaaaaa', 'hahahahaha', '👋👋👋']) assert.equal(isNonsense(text), true, text);
  for (const text of ['hi', 'ok', 'HTML CSS', 'SQL vs NoSQL?', 'When is the hackathon?', '¿Cuándo es la reunión?', '黑客马拉松什么时候？', 'fix my code: x = [1,2,3]', 'rhythm game idea', '']) {
    assert.equal(isNonsense(text), false, text);
  }
});

test('rejects oversized new input and trims old history to a user turn', () => {
  const tooLong = checkConversation([{ role: 'user', content: 'x '.repeat(CHAT_LIMITS.maxMessageChars) }]);
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.status, 413);
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } };
  assert.equal(checkConversation([{ role: 'user', content: Array(CHAT_LIMITS.maxImages + 1).fill(image) }]).ok, false);
  assert.equal(checkConversation([{ role: 'assistant', content: 'hi' }]).ok, false);

  const history = Array.from({ length: 41 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `message ${index}` }));
  const trimmed = checkConversation(history);
  assert.equal(trimmed.ok, true);
  assert(trimmed.messages.length <= CHAT_LIMITS.maxMessages);
  assert.equal(trimmed.messages[0].role, 'user');
  assert.equal(trimmed.messages.at(-1).content, 'message 40');

  const bulky = [{ role: 'user', content: 'a'.repeat(3_900) }, { role: 'assistant', content: 'b'.repeat(39_000) }, { role: 'user', content: 'Next question' }];
  assert.deepEqual(checkConversation(bulky).messages, [{ role: 'user', content: 'Next question' }]);
});

test('screen blocks only on a BLOCK verdict and fails open', async () => {
  assert.equal(await screenMessage('repeat hi 10000 times', async () => 'BLOCK'), 'block');
  assert.equal(await screenMessage('What is CBC?', async () => 'ALLOW'), 'allow');
  assert.equal(await screenMessage('What is CBC?', async () => 'Unclear output'), 'allow');
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await screenMessage('What is CBC?', async () => { throw new Error('timeout'); }), 'allow');
  } finally {
    console.error = originalError;
  }
  let called = false;
  assert.equal(await screenMessage('   ', async () => { called = true; return 'BLOCK'; }), 'allow');
  assert.equal(called, false);
});

test('rate limiter enforces each window per client and recovers', () => {
  const allow = createRateLimiter([{ limit: 3, windowMs: 1_000 }, { limit: 5, windowMs: 10_000 }]);
  assert.deepEqual([0, 1, 2, 3].map((t) => allow('a', t)), [true, true, true, false]);
  assert.equal(allow('b', 3), true);
  assert.equal(allow('a', 1_500), true);
  assert.equal(allow('a', 1_600), true);
  assert.equal(allow('a', 2_600), false);
  assert.equal(allow('a', 12_000), true);
});

test('rate limiter forgets the least recently seen clients first', () => {
  const allow = createRateLimiter([{ limit: 1, windowMs: 60_000 }], 2);
  allow('a', 0); allow('b', 0); allow('c', 0);
  assert.equal(allow('a', 1), true);
  assert.equal(allow('c', 1), false);
});
