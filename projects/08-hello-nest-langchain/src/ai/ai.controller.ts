import { Controller, Get, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { from, map } from 'rxjs';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('chat')
  async chat(@Query('question') question: string) {
    const answer = await this.aiService.runChain(question);
    return { answer };
  }

  @Sse('chat/stream')
  chatStream(@Query('query') query: string) {
    return from(this.aiService.streamChain(query)).pipe(
      map((chunk) => ({ data: chunk })),
    );
  }
}
