import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiModule } from './ai/ai.module.js';
import { ConfigModule } from '@nestjs/config';
import { SpeechModule } from './speech/speech.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    AiModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      maxListeners: 200,
    }),
    SpeechModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
