import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { type StructuredToolInterface } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { UIMessage } from 'ai';
import { toBaseMessages, toUIMessageStream } from '@ai-sdk/langchain';

@Injectable()
export class AiService {
  private readonly agent: ReturnType<typeof createAgent>;
  constructor(
    @Inject('CHAT_MODEL')
    private readonly model: ChatOpenAI,
    @Inject('WEB_SEARCH_TOOL')
    private readonly webSearchTool: StructuredToolInterface,
    @Inject('GET_LOCAL_TIME')
    private readonly getLocalTimeTool: StructuredToolInterface,
  ) {
    this.agent = createAgent({
      model,
      tools: [this.webSearchTool, this.getLocalTimeTool],
      systemPrompt:
        '你是一个智能助手，可以按需调用 web_search 搜索互联网，再根据结果回答用户。' +
        '当本轮问题涉及今天、最近、最新、今年等相对时间时，必须先调用 get_local_time，' +
        '等待时间结果后再调用 web_search，以返回的北京时间解释相对时间和确定搜索日期。' +
        '不要根据训练知识猜测当前年份，也不要把历史对话中的日期当作当前日期。',
    });
  }

  async stream(messages: UIMessage[]) {
    const lcMessages = await toBaseMessages(messages);
    const lgStream = await this.agent.stream(
      { messages: lcMessages },
      {
        streamMode: ['messages', 'values'],
        recursionLimit: 12,
      },
    );
    return toUIMessageStream(lgStream);
  }
}
