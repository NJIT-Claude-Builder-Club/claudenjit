import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { DEFAULT_MCP_TOOLS, executeMCPTool } from '@/lib/mcp-tools';
import { getSystemMessage } from '@/lib/chat-policy';
import {
  DECLINED_REPLY, SCREEN_SYSTEM, UNCLEAR_REPLY,
  checkConversation, clientKey, createRateLimiter, isNonsense, messageText, screenMessage,
} from '@/lib/chat-guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Best effort: counts are per server instance and reset on cold starts.
const allowRequest = createRateLimiter();

function getChatError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401 || error.status === 403) {
      return 'Chat is temporarily unavailable because its API credentials need attention.';
    }
    if (error.status === 429) {
      return 'Chat is busy right now. Please try again shortly.';
    }
  }
  return 'Chat could not complete your response. Please try again.';
}

export async function POST(req: NextRequest) {
  let messages: Anthropic.MessageParam[];
  try {
    const body = await req.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0 ||
        body.messages.some((message: Anthropic.MessageParam) =>
          !message || !['user', 'assistant'].includes(message.role) ||
          !(typeof message.content === 'string' || Array.isArray(message.content)))) {
      return Response.json({ error: 'Please send a valid conversation.' }, { status: 400 });
    }
    messages = body.messages;
  } catch {
    return Response.json({ error: 'Please send valid JSON.' }, { status: 400 });
  }

  if (!allowRequest(clientKey(req.headers))) {
    return Response.json({ error: "You're sending messages too quickly. Please wait a minute and try again." }, { status: 429 });
  }
  const checked = checkConversation(messages);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: checked.status });
  messages = checked.messages;
  const latestText = messageText(messages[messages.length - 1].content);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Chat configuration error: ANTHROPIC_API_KEY is missing');
    return Response.json({ error: 'Chat is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  let cancelled = false;
  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const reply = (text: string) => {
        send({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
        send({ type: 'message_stop' });
      };
      try {
        const conversationMessages = [...messages];
        send({ type: 'message_start' });
        if (isNonsense(latestText)) return reply(UNCLEAR_REPLY);
        send({ type: 'thinking' });
        const verdict = await screenMessage(latestText, async (text) => {
          const screen = await anthropic.messages.create({
            model: process.env.ANTHROPIC_SCREEN_MODEL || 'claude-haiku-5-5',
            max_tokens: 5,
            thinking: { type: 'disabled' },
            system: SCREEN_SYSTEM,
            messages: [{ role: 'user', content: `<message>\n${text}\n</message>` }],
          }, { signal: req.signal, timeout: 5_000, maxRetries: 0 });
          return screen.content.map((block) => block.type === 'text' ? block.text : '').join('');
        });
        if (cancelled) return;
        if (verdict === 'block') return reply(DECLINED_REPLY);
        // Bound tool calls so an unexpected tool loop cannot run indefinitely.
        for (let round = 0; round < 8; round++) {
          send({ type: 'thinking' });
          const stream = anthropic.messages.stream({
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: getSystemMessage(),
            messages: conversationMessages,
            tools: DEFAULT_MCP_TOOLS,
          }, { signal: req.signal });
          stream.on('text', (text) => {
            send({ type: 'content_block_delta', delta: { type: 'text_delta', text } });
          });
          const response = await stream.finalMessage();
          if (cancelled) return;
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              send({ type: 'tool_use', tool_use: block });
              const result = await executeMCPTool(block.name, block.input as Record<string, unknown>);
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
              send({ type: 'tool_result', tool_use_id: block.id, result });
            }
          }
          if (toolResults.length === 0) {
            send({ type: 'message_stop' });
            return;
          }
          conversationMessages.push({ role: 'assistant', content: response.content });
          conversationMessages.push({ role: 'user', content: toolResults });
        }
        throw new Error('Chat exceeded the tool-call limit');
      } catch (error) {
        // Keep provider details in server logs, not in public responses.
        console.error('Chat request failed:', error);
        send({ type: 'error', error: getChatError(error) });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
