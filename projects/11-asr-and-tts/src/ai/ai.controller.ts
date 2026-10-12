import { Controller, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { endWith, from, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AI_TTS_STREAM_EVENT,
  AiTtsStreamEvent,
} from '../common/stream-event.js';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('chat/stream')
  async stream(
    @Query('query') query: string,
    @Query('ttsSessionId') ttsSessionId?: string,
  ) {
    const sessionId = ttsSessionId?.trim();
    if (sessionId) {
      const startEvent: AiTtsStreamEvent = {
        type: 'start',
        sessionId,
        query,
      };
      this.eventEmitter.emit(AI_TTS_STREAM_EVENT, startEvent);
    }
    return from(this.aiService.streamChain(query, sessionId)).pipe(
      map((chunk) => ({ data: chunk })),
      endWith({ type: 'done', data: '' }),
    );
  }
}
