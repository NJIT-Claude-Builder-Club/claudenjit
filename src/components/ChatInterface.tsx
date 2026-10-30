'use client';

import React from 'react';
import Image from 'next/image';
import { useChatStore } from '@/lib/chat-store';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';
import { readChatEvents } from '@/lib/chat-stream';
import { TimeGreeting } from './TimeGreeting';
import { createTextSmoother, hasDisplayedCards } from '@/lib/chat-presentation';
import { useKeyboardViewport } from '@/lib/use-keyboard-viewport';
import { SquarePen } from 'lucide-react';

export function ChatInterface() {
  const viewportRef = useKeyboardViewport();
  const { messages, addMessage, updateMessage, clearMessages, isLoading, setLoading } =
    useChatStore();

  const sendMessage = async (content: string, images?: string[]) => {
    if (isLoading) return;
    let assistantMessageId: string | null = null;
    let textSmoother: ReturnType<typeof createTextSmoother> | null = null;
    // Add user message
    addMessage({
      role: 'user',
      content,
    });

    setLoading(true);
    assistantMessageId = addMessage({
      role: 'assistant', content: '', isStreaming: true, isThinking: true, toolsUsed: [],
    });

    try {
      // Prepare messages for API
      type MessageContent =
        | string
        | Array<
            | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
            | { type: 'text'; text: string }
          >;

      const apiMessages: Array<{ role: string; content: MessageContent }> = messages.filter((msg) => !msg.isError).map(
        (msg) => ({
          role: msg.role,
          content: msg.content,
        })
      );

      // Add the new user message with optional images
      if (images && images.length > 0) {
        // Format message with images for Claude API
        const messageContent: Exclude<MessageContent, string> = [];

        // Add images first
        images.forEach((imageData) => {
          // Extract base64 data and media type
          const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const mediaType = matches[1];
            const base64Data = matches[2];
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            });
          }
        });

        // Add text content if present
        if (content) {
          messageContent.push({
            type: 'text',
            text: content,
          });
        }

        apiMessages.push({
          role: 'user',
          content: messageContent,
        });
      } else {
        // Text-only message
        apiMessages.push({
          role: 'user',
          content,
        });
      }

      // Call the chat API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Chat is temporarily unavailable. Please try again.');
      }

      if (!response.body) throw new Error('Chat returned an empty response. Please try again.');
      textSmoother = createTextSmoother((text) => {
        if (assistantMessageId) updateMessage(assistantMessageId, { content: text, isThinking: false });
      }, { reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
      let currentContent = '';
      const toolsUsed: Array<{ id: string; name: string; input: unknown; result?: unknown }> = [];
      let completed = false;
      for await (const data of readChatEvents(response.body)) {
        if (data.type === 'error') throw new Error(data.error);
        if (data.type === 'message_start' && !assistantMessageId) {
          assistantMessageId = addMessage({ role: 'assistant', content: '', isStreaming: true, isThinking: true, toolsUsed: [] });
        } else if (data.type === 'thinking') {
          await textSmoother.finish();
          if (assistantMessageId) updateMessage(assistantMessageId, { isThinking: true });
        } else if (data.type === 'content_block_delta' && data.delta.type === 'text_delta') {
          currentContent += data.delta.text;
          textSmoother.append(data.delta.text);
        } else if (data.type === 'tool_use') {
          await textSmoother.finish();
          toolsUsed.push(data.tool_use);
          if (assistantMessageId) updateMessage(assistantMessageId, { toolsUsed: [...toolsUsed], isThinking: true });
        } else if (data.type === 'tool_result') {
          const tool = toolsUsed.find((item) => item.id === data.tool_use_id);
          if (tool) tool.result = data.result;
          if (assistantMessageId) updateMessage(assistantMessageId, { toolsUsed: [...toolsUsed] });
        } else if (data.type === 'message_stop') {
          completed = true;
        }
      }
      if (!completed || (!currentContent.trim() && !hasDisplayedCards(toolsUsed))) {
        throw new Error('Chat returned an incomplete response. Please try again.');
      }
      await textSmoother.finish();
      if (assistantMessageId) updateMessage(assistantMessageId, { isStreaming: false, isThinking: false });
    } catch (error) {
      textSmoother?.cancel();
      console.error('Error sending message:', error);
      const content = error instanceof Error ? error.message : 'Chat could not complete your response. Please try again.';
      if (assistantMessageId) {
        updateMessage(assistantMessageId, { content, isStreaming: false, isThinking: false, isError: true });
      } else {
        addMessage({ role: 'assistant', content, isError: true });
      }
    } finally {
      textSmoother?.cancel();
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div ref={viewportRef} className="chat-app">
      <header className="chat-header">
        <div className="brand-lockup">
          <span className="brand-name">CBC @ NJIT</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!hasMessages || confirm('Start a new chat? This will clear the current conversation.')) clearMessages();
          }}
          disabled={isLoading || !hasMessages}
          className="new-chat-button"
          title="New chat"
          aria-label="New chat"
        >
          <SquarePen size={18} aria-hidden="true" />
          <span>New chat</span>
        </button>
      </header>

      <main className={hasMessages ? 'conversation-view' : 'welcome-view'}>
        {!hasMessages ? (
          <div className="welcome-content">
            <h1 className="welcome-heading">
              <Image src="/claude-ai.png" width={48} height={48} alt="" priority />
              <TimeGreeting />
            </h1>
            <ChatInput onSend={sendMessage} disabled={isLoading} />
          </div>
        ) : (
          <>
            <MessageList />
            <div className="conversation-composer">
              <ChatInput onSend={sendMessage} disabled={isLoading} />
              <p className="chat-disclaimer">Claude can make mistakes. Please double-check responses.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
