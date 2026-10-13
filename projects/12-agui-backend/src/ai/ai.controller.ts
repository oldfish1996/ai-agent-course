import {
  Controller,
  Post,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { type UIMessage, pipeUIMessageStreamToResponse } from 'ai';
import { AiService } from './ai.service.js';
import type { Response } from 'express';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
    本地测试：
    curl -N -sS -X POST 'http://localhost:3000/ai/chat' \
      -H 'Content-Type: application/json' \
      -d '{"messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"北京今天的天气"}]}]}'
   */
  @Post('chat')
  async postChat(
    @Body() body: { messages?: UIMessage[] },
    @Res() res: Response,
  ) {
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new BadRequestException('Invalid JSON');
    }

    // 不加 await：启动流后控制器就返回；如果返回的 Promise 被拒绝，Nest 无法通过控制器捕获它。
    //加 await：控制器等待流写入完成，Promise 的错误会沿控制器传给 Nest。不过响应头发出后，Nest 也无法再改成普通 JSON 错误响应。
    const stream = await this.aiService.stream(body.messages);
    await pipeUIMessageStreamToResponse({ response: res, stream });
  }
}
