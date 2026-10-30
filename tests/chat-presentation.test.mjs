import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTextSmoother, getClubLinks, getTimeGreeting } from '../src/lib/chat-presentation.ts';

test('greeting switches at local morning, noon, and evening boundaries', () => {
  for (const [hour, period] of [[0,'evening'],[4,'evening'],[5,'morning'],[11,'morning'],[12,'afternoon'],[16,'afternoon'],[17,'evening'],[23,'evening']]) {
    assert.equal(getTimeGreeting(hour), `Good ${period}, Highlander!`);
  }
});

function harness(reducedMotion = false) {
  let time = 0, id = 0;
  const frames = new Map(), updates = [];
  const smoother = createTextSmoother((text) => updates.push(text), {
    reducedMotion,
    schedule: (callback) => { frames.set(++id, callback); return id; },
    cancelFrame: (frame) => frames.delete(frame),
  });
  function tick() { const callbacks = [...frames.values()]; frames.clear(); time += 16; callbacks.forEach((callback) => callback(time)); }
  function drain() { let count = 0; while (frames.size) { if (++count > 1000) throw new Error('Animation did not finish'); tick(); } }
  return { smoother, updates, frames, tick, drain };
}

test('smooths large bursts over multiple frames and finishes without losing Unicode', async () => {
  const h = harness();
  const text = 'Hello 👋, Highlander! '.repeat(15);
  h.smoother.append(text);
  assert.equal(h.updates.length, 0);
  h.tick();
  assert(h.updates[0].length > 0 && h.updates[0].length < text.length);
  let complete = false;
  const done = h.smoother.finish().then(() => { complete = true; });
  await Promise.resolve(); assert.equal(complete, false);
  h.drain(); await done;
  assert.equal(h.updates.at(-1), text);
  assert(h.updates.length > 3);
  assert(h.updates.every((update) => text.startsWith(update) && !/[\uD800-\uDBFF]$/.test(update)));
});

test('preserves successive chunks and tool pauses', async () => {
  const h = harness();
  h.smoother.append('First'); h.smoother.append(' reply.');
  h.drain(); await h.smoother.finish();
  h.smoother.append(' After a tool lookup.'); h.drain(); await h.smoother.finish();
  assert.equal(h.updates.at(-1), 'First reply. After a tool lookup.');
});

test('cancellation discards queued text and settles completion waiters', async () => {
  const h = harness(); h.smoother.append('Never display this after an error');
  const done = h.smoother.finish(); h.smoother.cancel(); await done; h.drain();
  h.smoother.append('ignored'); assert.equal(h.updates.length, 0); assert.equal(h.frames.size, 0);
});

test('reduced motion displays chunks immediately', async () => {
  const h = harness(true); h.smoother.append('Hello'); h.smoother.append(' NJIT!');
  await h.smoother.finish(); assert.equal(h.updates.at(-1), 'Hello NJIT!'); assert.equal(h.frames.size, 0);
});

test('club link cards use only well-formed show_club_links results with safe URLs', () => {
  const discord = { channel: 'discord', label: 'Discord', description: 'Chat', url: 'https://discord.gg/x' };
  const email = { channel: 'email', label: 'Email', description: 'a@b.c', url: 'mailto:a@b.c' };
  assert.deepEqual(getClubLinks([
    { name: 'get_club_info', result: { links: [discord] } },
    { name: 'show_club_links' },
    { name: 'show_club_links', result: { status: 'not_confirmed' } },
    { name: 'show_club_links', result: { links: [discord, null, { ...email, channel: 'bad', url: 'javascript:alert(1)' }, { channel: 'x' }] } },
    { name: 'show_club_links', result: { links: [email, discord] } },
  ]), [discord, email]);
  assert.deepEqual(getClubLinks(), []);
});
