import { Inject, Injectable } from '@nestjs/common';
import { type Runnable } from '@langchain/core/runnables';
import { type ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AI_TTS_STREAM_EVENT,
  AiTtsStreamEvent,
} from '../common/stream-event.js';

@Injectable()
export class AiService {
  private readonly chain: Runnable;
  constructor(
    @Inject('CHAT_MODEL') private readonly model: ChatOpenAI,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const prompt = PromptTemplate.fromTemplate('回答以下问题：{query}');
    this.chain = prompt.pipe(this.model).pipe(new StringOutputParser());
  }

  async *streamChain(
    query: string,
    ttsSessionId?: string,
  ): AsyncGenerator<string> {
    try {
      const stream = await this.chain.stream({ query });
      for await (const chunk of stream) {
        if (ttsSessionId) {
          this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
            type: 'chunk',
            sessionId: ttsSessionId,
            chunk,
          } satisfies AiTtsStreamEvent);
        }
        yield chunk;
      }
      if (ttsSessionId) {
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
          type: 'end',
          sessionId: ttsSessionId,
        } satisfies AiTtsStreamEvent);
      }
    } catch (error) {
      if (ttsSessionId) {
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
          type: 'error',
          sessionId: ttsSessionId,
          error: error instanceof Error ? error.message : 'AI 回答生成失败',
        } satisfies AiTtsStreamEvent);
      }
      throw error;
    }
  }
}
