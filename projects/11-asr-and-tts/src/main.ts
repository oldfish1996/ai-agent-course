import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { TtsRelayService } from './speech/tts-relay.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'public'));

  const ttsRelayService = app.get<TtsRelayService>(TtsRelayService);
  const server = app.getHttpServer();

  const wss = new WebSocketServer({ server, path: '/speech/tts/ws' });
  wss.on('connection', (socket, request) => {
    const reqUrl = new URL(request.url || '', 'http://localhost');
    const wantedSessionId = reqUrl.searchParams.get('ttsSessionId');
    const sessionId = ttsRelayService.registerClient(
      socket,
      wantedSessionId || undefined,
    );

    socket.on('close', () => {
      ttsRelayService.unregisterClient(sessionId);
    });
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
