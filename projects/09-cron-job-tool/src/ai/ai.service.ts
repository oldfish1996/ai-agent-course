import { tool } from '@langchain/core/tools';
import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
} from '@langchain/core/messages';

const database: Record<string, Record<string, any>> = {
  users: {
    '001': {
      id: '001',
      name: '张三',
      email: 'zhangsan@exKample.com',
      role: 'admin',
    },
    '002': {
      id: '002',
      name: '李四',
      email: 'lisi@examplle.com',
      role: 'user',
    },
    '003': {
      id: '003',
      name: '王五',
      email: 'wangwu@exarmple.com',
      role: 'user',
    },
  },
};

const queryUserSchema = z.object({
  userId: z.string().describe('用户ID, 例如: 001,002,003'),
});

const queryUserTool = tool(
  async ({ userId }: { userId: string }) => {
    const user = database.users[userId];
    if (!user) {
      return `用户 ${userId} 不存在`;
    }
    return JSON.stringify(user);
  },
  {
    name: 'query_user',
    description: '查询用户信息',
    schema: queryUserSchema,
  },
);

type AiStreamEvent =
  | { type: 'token'; data: { content: string } }
  | {
      type: 'tool_start';
      data: { toolCallId: string; toolName: string; args: unknown };
    }
  | {
      type: 'tool_end';
      data: { toolCallId: string; result: string; toolName: string };
    }
  | {
      type: 'tool_error';
      data: { toolCallId: string; message: string; toolName: string };
    }
  | {
      type: 'done';
      data: Record<string, never>;
    };

@Injectable()
export class AiService {
  private readonly modelWithTools: ReturnType<ChatOpenAI['bindTools']>;

  constructor(
    @Inject('CHAT_MODEL') private readonly model: ChatOpenAI,
    @Inject('USER_MANAGER_TOOL')
    private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
  ) {
    this.modelWithTools = this.model.bindTools([
      this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
    ]);
  }

  async runChain(query: string) {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手,可以在需要时调用工具(如query_user)来查询用户信息,再用结果回答用户的问题。',
      ),
      new HumanMessage(query),
    ];

    const toolMap = new Map([
      ['query_user', this.queryUserTool],
      ['send_mail', this.sendMailTool],
      ['web_search', this.webSearchTool],
    ]);

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return aiMessage.content;
      }
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name || '';

        const tool = toolMap.get(toolName);
        if (!tool) {
          continue;
        }
        const response = await tool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            content: response,
            name: toolName,
          }),
        );
      }
    }
  }

  async *runChainStream(query: string): AsyncGenerator<AiStreamEvent> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手,可以在需要时调用工具(如query_user)来查询用户信息,再用结果回答用户的问题。',
      ),
      new HumanMessage(query),
    ];
    const toolMap = new Map([
      ['query_user', this.queryUserTool],
      ['send_mail', this.sendMailTool],
      ['web_search', this.webSearchTool],
    ]);
    while (true) {
      const stream = await this.modelWithTools.stream(messages);
      let fullAIMessages: AIMessageChunk | null = null;
      for await (const chunk of stream) {
        fullAIMessages = fullAIMessages ? fullAIMessages.concat(chunk) : chunk;
        const hasToolCallChunk =
          !!fullAIMessages?.tool_call_chunks &&
          fullAIMessages.tool_call_chunks.length > 0;
        if (
          !hasToolCallChunk &&
          typeof chunk.content === 'string' &&
          chunk.content.length > 0
        ) {
          // yield chunk.content;
          yield {
            type: 'token',
            data: { content: chunk.content },
          };
        }
      }
      if (!fullAIMessages) {
        return;
      }
      messages.push(fullAIMessages);
      const toolCalls = fullAIMessages.tool_calls ?? [];
      if (toolCalls.length === 0) {
        yield {
          type: 'done',
          data: {},
        };
        return;
      }
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name || '';
        const selectedTool = toolMap.get(toolName);
        yield {
          type: 'tool_start',
          data: { toolCallId, toolName, args: toolCall.args },
        };
        if (!selectedTool) {
          yield {
            type: 'tool_error',
            data: { toolCallId, toolName, message: `工具不存在: ${toolName}` },
          };
          continue;
        }
        try {
          const response = await selectedTool.invoke(toolCall.args);
          yield {
            type: 'tool_end',
            data: { toolCallId, result: response, toolName },
          };
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content:
                typeof response === 'string'
                  ? response
                  : JSON.stringify(response),
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(message);
          yield {
            type: 'tool_error',
            data: { toolCallId, toolName, message },
          };
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              content: `工具调用失败: ${message}`,
              name: toolName,
            }),
          );
        }
      }
    }
  }
}
