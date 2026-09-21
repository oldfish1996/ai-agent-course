import { Controller, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { from, map } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Sse('chat/stream')
  async stream(@Query('query') query: string) {
    return from(this.aiService.streamChain(query)).pipe(
      map((chunk) => ({ data: chunk })),
    );
  }
}
