import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service.js';
import { SpeechController } from './speech.controller.js';
import { ConfigService } from '@nestjs/config';
import tencentcloud from 'tencentcloud-sdk-nodejs';
import { TtsRelayService } from './tts-relay.service.js';

const AsrClient = tencentcloud.asr.v20190614.Client;

@Module({
  controllers: [SpeechController],
  exports: [TtsRelayService],
  providers: [
    SpeechService,
    TtsRelayService,
    {
      provide: 'ASR_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new AsrClient({
          credential: {
            secretId: config.get('SECRET_ID'),
            secretKey: config.get('SECRET_KEY'),
          },
          region: 'ap-shanghai',
          profile: {
            httpProfile: {
              reqTimeout: 30,
              reqMethod: 'POST',
            },
          },
        }),
    },
  ],
})
export class SpeechModule {}
