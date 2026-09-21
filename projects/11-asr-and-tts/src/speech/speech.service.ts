import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import tencentcloud from 'tencentcloud-sdk-nodejs';

type UploadedAudio = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type AsrClient = InstanceType<typeof tencentcloud.asr.v20190614.Client>;

const voiceFormatByMimeType = {
  'audio/ogg': 'ogg-opus',
  'application/ogg': 'ogg-opus',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
} as const;

@Injectable()
export class SpeechService {
  constructor(@Inject('ASR_CLIENT') private readonly asrClient: AsrClient) {}

  async recognizeAudio(file: UploadedAudio) {
    const mimeType = file.mimetype.toLowerCase().split(';', 1)[0];
    const voiceFormat =
      voiceFormatByMimeType[mimeType as keyof typeof voiceFormatByMimeType];
    if (!voiceFormat) {
      throw new BadRequestException(`不支持的音频格式：${file.mimetype}`);
    }

    const audioBase64 = file.buffer.toString('base64');
    const data = await this.asrClient.SentenceRecognition({
      EngSerViceType: '16k_zh',
      SourceType: 1,
      Data: audioBase64,
      DataLen: file.buffer.length,
      VoiceFormat: voiceFormat,
    });
    return data.Result;
  }
}
