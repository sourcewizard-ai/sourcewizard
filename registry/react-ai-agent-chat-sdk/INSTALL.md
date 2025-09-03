# React AI Agent Chat SDK

A React library for building AI-powered chat interfaces with tool execution, configurable timeouts, retry logic, and custom renderers.

## Quick Start

### 1. Install the Package

```bash
npm install react-ai-agent-chat-sdk
# or
pnpm add react-ai-agent-chat-sdk
```

**Peer Dependencies:**
```bash
npm install react react-dom zod
```

**AI Provider (choose one):**
```bash
# For Anthropic Claude models
npm install @ai-sdk/anthropic

# For OpenAI models  
npm install @ai-sdk/openai
```

### 2. Define Your Tools

Create tools with Zod schemas for type-safe input validation:

```typescript
import { z } from 'zod';
import { createTool } from 'react-ai-agent-chat-sdk/config';

const readFileSchema = z.object({
  file_path: z.string().describe('The path to the file to read'),
});

const tools = {
  read_file: createTool({
    description: 'Read the contents of a file',
    display_name: "Reading file",
    inputSchema: readFileSchema,
    execute: async ({ file_path }) => {
      const content = await fs.readFile(file_path, 'utf-8');
      return { file_path, content };
    }
  })
};
```

### 3. Define Configuration

Create both client and server configurations:

```typescript
import { makeAgentChatConfig } from 'react-ai-agent-chat-sdk/config';
import { anthropic } from '@ai-sdk/anthropic';

const { agentChatConfig, agentChatRouteConfig } = makeAgentChatConfig({
  system_prompt: `You are a helpful assistant with access to file management tools.`,
  route: "/api/chat",
  tools,
  auth_func: async () => true, // Replace with your auth logic
  modelConfig: {
    model: anthropic('claude-sonnet-4-20250514'),
    temperature: 0.3
  }
});
```

### 4. Add Chat and History Routes

Create API routes for chat and history:

**Chat Route (`app/api/chat/route.ts`):**
```typescript
import { chatRoute } from 'react-ai-agent-chat-sdk/api';
import { agentChatRouteConfig } from '@/lib/agent-config';

export async function POST(req: Request) {
  return chatRoute(agentChatRouteConfig, req);
}
```

**History Route (`app/api/chat/history/route.ts`):**
```typescript
import { chatHistoryRoute } from 'react-ai-agent-chat-sdk/api';
import { agentChatRouteConfig } from '@/lib/agent-config';

export async function GET(req: Request) {
  return chatHistoryRoute(agentChatRouteConfig, req);
}
```

### 5. Add AgentChat UI Element

Use the chat component in your React app:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { AgentChat } from 'react-ai-agent-chat-sdk';
import 'react-ai-agent-chat-sdk/agent-chat.css';
import { agentChatConfig } from '@/lib/agent-config';

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string>('');
  
  useEffect(() => {
    // Load or create conversation ID for persistence
    let id = localStorage.getItem('current-conversation-id');
    if (!id) {
      id = `conv_${crypto.randomUUID()}`;
      localStorage.setItem('current-conversation-id', id);
    }
    setConversationId(id);
  }, []);
  
  if (!conversationId) {
    return <div>Loading...</div>;
  }
  
  return (
    <AgentChat 
      config={agentChatConfig} 
      conversationId={conversationId} 
    />
  );
}
```

## Customization

### Tool Renderers

Create custom renderers for specific tools:

```typescript
import { ToolCall, ToolResult } from 'react-ai-agent-chat-sdk/config';

export function CustomFileRenderer({ toolCall, toolResult }: { 
  toolCall: ToolCall; 
  toolResult?: ToolResult 
}) {
  const hasError = toolResult?.output?.__toolError;
  const isTimeout = hasError && toolResult?.output?.__errorType === 'ToolTimeoutError';
  
  const getStatusText = () => {
    if (isTimeout) return 'Timed out';
    if (hasError) return 'Error';
    if (toolResult?.output) return 'Completed';
    return 'Running';
  };

  return (
    <div className={`custom-renderer ${hasError ? 'error' : ''}`}>
      <div>📁 {toolCall.toolName} - {getStatusText()}</div>
      {toolResult?.output && (
        <pre>{JSON.stringify(toolResult.output, null, 2)}</pre>
      )}
    </div>
  );
}
```

Add renderers to your configuration:

```typescript
// lib/agent-chat-client-config.ts
import { AgentChatConfig } from 'react-ai-agent-chat-sdk/config';
import { CustomFileRenderer } from './renderers';

export function createClientConfig(config: AgentChatConfig): AgentChatConfig {
  return {
    ...config,
    toolRenderers: {
      read_file: CustomFileRenderer,
    }
  };
}
```

### Route Parameters

Customize API endpoints to fit your application structure:

```typescript
const { agentChatConfig, agentChatRouteConfig } = makeAgentChatConfig({
  system_prompt: "You are a helpful assistant.",
  route: "/api/v1/chat", // Custom chat route
  tools,
  auth_func: async () => true,
  historyRoute: "/api/v1/history" // Custom history route (optional)
});
```

### Retry Configurations

Configure timeouts and retries globally and per-tool:

**Global Configuration:**
```typescript
const { agentChatConfig, agentChatRouteConfig } = makeAgentChatConfig({
  system_prompt: "You are a helpful assistant.",
  route: "/api/chat",
  tools,
  auth_func: async () => true,
  toolExecutionConfig: {
    timeoutMs: 30000, // 30 seconds default
    retries: 3,
    retryDelayMs: 1000 // 1 second initial delay
  }
});
```

**Per-Tool Configuration:**
```typescript
const tools = {
  slow_operation: createTool({
    description: 'A slow operation that needs longer timeout',
    display_name: "Processing data",
    inputSchema: z.object({}),
    execute: async () => {
      // Long-running operation
    },
    executionConfig: {
      timeoutMs: 60000, // 1 minute timeout
      retries: 1, // Only 1 retry
      retryDelayMs: 5000 // 5 second delay
    }
  })
};
```

**Storage Configuration:**
```typescript
import { MemoryStorage } from 'react-ai-agent-chat-sdk/storage';

// For development
const storage = new MemoryStorage();

// For production, implement ChatStorage interface
class MyStorage implements ChatStorage {
  async saveMessage(conversationId: string, message: ChatMessage): Promise<void> {
    // Save to your database
  }
  
  async getConversation(conversationId: string): Promise<Conversation | null> {
    // Retrieve from your database
  }
}

const { agentChatConfig, agentChatRouteConfig } = makeAgentChatConfig({
  system_prompt: "You are a helpful assistant.",
  route: "/api/chat",
  tools,
  auth_func: async () => true,
  storage // Add storage for conversation persistence
});
```

**Model Configuration:**
```typescript
import { openai } from '@ai-sdk/openai';
import { messageCountIs } from 'ai';

const { agentChatConfig, agentChatRouteConfig } = makeAgentChatConfig({
  system_prompt: "You are a helpful assistant.",
  route: "/api/chat",
  tools,
  auth_func: async () => true,
  modelConfig: {
    model: openai('gpt-4o'), // Use different AI models
    temperature: 0.7,
    stopWhen: messageCountIs(10), // Stop after 10 messages
    onStepFinish: (step) => {
      console.log('Step finished:', step.finishReason);
    }
  }
});
```