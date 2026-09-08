import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  controllers: [AiController],
  providers: [AiService, {
    provide: 'CHAT_MODEL',
    useFactory: (configService: ConfigService) => new ChatOpenAI({
      temperature: 0.7,
      apiKey: configService.getOrThrow('OPENAI_API_KEY'),
      model: configService.getOrThrow('MODEL_NAME'),
      configuration: {
        baseURL: configService.getOrThrow('OPENAI_BASE_URL'),
      },
    }),
    inject: [ConfigService],
  }],
})
export class AiModule {}
