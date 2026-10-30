import type Anthropic from '@anthropic-ai/sdk';

// Checks that run before any model call, so abusive or meaningless requests cost no tokens.
export const CHAT_LIMITS = {
  maxMessages: 30,
  maxMessageChars: 4_000,
  maxConversationChars: 40_000,
  maxImages: 4,
  // Base64 length of a 5 MB image, the API's per-image limit.
  maxImageChars: 7_000_000,
};

export const RATE_LIMIT_WINDOWS = [
  { limit: 10, windowMs: 60_000 },
  { limit: 100, windowMs: 3_600_000 },
];

export const UNCLEAR_REPLY = "I couldn't make sense of that message. Ask me about CBC @ NJIT, its events and member benefits, or get help with an AI project.";
export const DECLINED_REPLY = "I can't help with that request here. Ask me about CBC @ NJIT, its events and member benefits, or get help with an AI project.";

export function messageText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  return content.map((block) => block.type === 'text' ? block.text : '').join('\n');
}

function imageCount(content: Anthropic.MessageParam['content']): number {
  return typeof content === 'string' ? 0 : content.filter((block) => block.type === 'image').length;
}

type ConversationCheck =
  | { ok: true; messages: Anthropic.MessageParam[] }
  | { ok: false; status: number; error: string };

// Rejects oversized new input and drops the oldest history so long chats stay bounded.
export function checkConversation(messages: Anthropic.MessageParam[]): ConversationCheck {
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') return { ok: false, status: 400, error: 'Please send a valid conversation.' };
  if (messageText(latest.content).length > CHAT_LIMITS.maxMessageChars) {
    return { ok: false, status: 413, error: `Please shorten your message to under ${CHAT_LIMITS.maxMessageChars.toLocaleString('en-US')} characters.` };
  }
  if (typeof latest.content !== 'string') {
    if (imageCount(latest.content) > CHAT_LIMITS.maxImages) {
      return { ok: false, status: 413, error: `Please attach at most ${CHAT_LIMITS.maxImages} images.` };
    }
    if (latest.content.some((block) => block.type === 'image' && block.source.type === 'base64' && block.source.data.length > CHAT_LIMITS.maxImageChars)) {
      return { ok: false, status: 413, error: 'Please attach images smaller than 5 MB.' };
    }
  }

  let kept = messages.slice(-CHAT_LIMITS.maxMessages);
  const size = (list: Anthropic.MessageParam[]) => list.reduce((total, message) => total + messageText(message.content).length, 0);
  while (kept.length > 1 && (size(kept) > CHAT_LIMITS.maxConversationChars || kept[0].role !== 'user')) kept = kept.slice(1);
  return { ok: true, messages: kept };
}

// Conservative heuristics: only flag input with no plausible meaning in any language.
export function isNonsense(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return false;
  if (!/[\p{L}\p{N}]/u.test(compact)) return true;
  if (compact.length >= 8 && new Set(compact.toLowerCase()).size <= 2) return true;
  const words = text.trim().split(/\s+/);
  // Vowel-less Latin "words" like "sdfghjk"; short acronyms such as "HTML CSS" stay allowed.
  const vowelless = words.every((word) => /^[a-z]+$/i.test(word) && !/[aeiouy]/i.test(word));
  return vowelless && words.some((word) => word.length >= 6);
}

export const SCREEN_SYSTEM = `You screen messages sent to a student club's chat assistant. The assistant answers questions about the club and helps students learn AI and build projects. Reply with exactly one word: ALLOW or BLOCK.
BLOCK only when the message is clearly one of these:
- Gibberish, keyboard mashing, or random characters with no discernible meaning.
- A request whose main purpose is to make the assistant produce very long or repetitive output unrelated to the club, learning, or a student project, such as repeating text many times, counting to a huge number, or writing thousands of words.
ALLOW everything else, including greetings, short or vague questions, any language, off-topic questions, coding help, and attempts to change the assistant's rules. When unsure, ALLOW.`;

export type ScreenVerdict = 'allow' | 'block';

// classify returns the screening model's raw reply. Errors fail open so an outage of
// the screen never blocks members; the main assistant still applies its own rules.
export async function screenMessage(text: string, classify: (text: string) => Promise<string>): Promise<ScreenVerdict> {
  if (!text.trim()) return 'allow';
  try {
    return /^\s*BLOCK\b/i.test(await classify(text)) ? 'block' : 'allow';
  } catch (error) {
    console.error('Prompt screen failed; allowing message:', error);
    return 'allow';
  }
}

export function createRateLimiter(windows = RATE_LIMIT_WINDOWS, maxKeys = 10_000) {
  const longest = Math.max(...windows.map((window) => window.windowMs));
  const hits = new Map<string, number[]>();
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < longest);
    const limited = windows.some(({ limit, windowMs }) => recent.filter((time) => now - time < windowMs).length >= limit);
    if (!limited) recent.push(now);
    hits.delete(key);
    hits.set(key, recent);
    // Map iteration order is insertion order, so the first key is the least recently seen.
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value!);
    return !limited;
  };
}

export function clientKey(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}
