import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: 'CHAT_MODEL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new ChatOpenAI({
          // temperature: 0.7,
          apiKey: configService.get('OPENAI_API_KEY'),
          model: configService.get('MODEL_NAME'),
          configuration: {
            baseURL: configService.get('OPENAI_BASE_URL'),
          },
        }),
    },
  ],
})
export class AiModule {}
