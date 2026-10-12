import { OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'node:crypto';
import WebSocket from 'ws';
import {
  AI_TTS_STREAM_EVENT,
  type AiTtsStreamEvent,
} from '../common/stream-event.js';
import { ConfigService } from '@nestjs/config';

type ClientSession = {
  sessionId: string;
  clientWs: WebSocket;
  tencentWs?: WebSocket;
  ready: boolean;
  pendingChunks: string[];
  pendingComplete: boolean;
  closed: boolean;
};

export class TtsRelayService implements OnModuleDestroy {
  private readonly sessions = new Map<string, ClientSession>();
  private readonly logger = new Logger(TtsRelayService.name);
  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly appId: number;
  private readonly voiceType: number;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.secretId = configService.get('SECRET_ID') || '';
    this.secretKey = configService.get('SECRET_KEY') || '';
    this.appId = configService.get('APP_ID') || 0;
    this.voiceType = configService.get('VOICE_TYPE') || 101001;
  }

  async onModuleDestroy() {
    for (const session of this.sessions.values()) {
      this.closeSession(session.sessionId, 'module destroy');
    }
  }

  registerClient(clientWs: WebSocket, wantedSessionId?: string) {
    const sessionId = wantedSessionId?.trim() || crypto.randomUUID();
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.closeSession(existing.sessionId, 'register, client reconnected');
    }
    this.sessions.set(sessionId, {
      sessionId,
      clientWs,
      ready: false,
      pendingChunks: [],
      pendingComplete: false,
      closed: false,
    });
    this.sendClientJson(clientWs, {
      type: 'session',
      sessionId,
    });
    this.logger.log(`[REGISTER] TTS ws registered: ${sessionId}`);
    return sessionId;
  }

  unregisterClient(sessionId: string) {
    this.closeSession(sessionId, 'unregister, client disconnected');
  }

  @OnEvent(AI_TTS_STREAM_EVENT)
  handleAiSteamEvent(event: AiTtsStreamEvent) {
    const session = this.sessions.get(event.sessionId);
    if (!session) {
      return;
    }
    switch (event.type) {
      case 'start':
        this.ensureTencentConnection(session);
        this.sendClientJson(session.clientWs, {
          type: 'tts_started',
          sessionId: session.sessionId,
          query: event.query,
        });
        break;
      case 'chunk':
        const chunk = event.chunk;
        if (!chunk) {
          return;
        }
        if (
          !session.ready ||
          !session.tencentWs ||
          session.tencentWs.readyState !== WebSocket.OPEN
        ) {
          session.pendingChunks.push(chunk);
          return;
        }
        this.sendTencentChunk(session, chunk);
        break;
      case 'end':
        session.pendingComplete = true;
        this.flushPendingChunks(session);
        break;
      case 'error':
        this.sendClientJson(session.clientWs, {
          type: 'tts_error',
          message: event.error,
        });
        this.closeSession(session.sessionId, 'ai stream error');
        break;
      default:
        break;
    }
  }

  private ensureTencentConnection(session: ClientSession) {
    const wsUrl = this.buildTtsWsUrl(session.sessionId);

    const ws = new WebSocket(wsUrl);
    session.tencentWs = ws;
    session.ready = false;

    ws.on('open', () => {
      this.logger.log(`[OPEN] TTS ws opend: ${session.sessionId}`);
    });

    ws.on('message', (data, isBinary) => {
      if (session.closed) return;
      if (isBinary) {
        // 二进制帧：音频数据
        if (session.clientWs.readyState === WebSocket.OPEN) {
          session.clientWs.send(data, { binary: true });
        }
        return;
      }
      // 文本帧：JSON 事件
      const raw = data.toString();
      let msg: Record<string, any> | undefined;
      try {
        msg = JSON.parse(raw) as Record<string, any>;
      } catch (error) {
        this.logger.error(`[ERROR] JSON.parse error: ${error}`);
        return;
      }

      if (Number(msg.ready) === 1) {
        session.ready = true;
        this.flushPendingChunks(session);
      }

      if (Number(msg.code) && Number(msg.code) !== 0) {
        this.sendClientJson(session.clientWs, {
          type: 'tts_error',
          sessionId: session.sessionId,
          error: msg.message,
        });
        this.closeSession(session.sessionId, 'tencent error');
        return;
      }

      if (Number(msg.final) === 1) {
        this.sendClientJson(session.clientWs, { type: 'tts_done' });
        this.closeSession(session.sessionId, 'tts complete');
      }
    });

    ws.on('error', (error) => {
      if (session.closed) return;
      this.sendClientJson(session.clientWs, {
        type: 'tts_error',
        message: error.message,
      });
      this.closeSession(session.sessionId, 'tencent connection error');
    });

    ws.on('close', () => {
      if (session.closed) return;
      this.sendClientJson(session.clientWs, {
        type: 'tts_error',
        message: '语音合成连接意外断开',
      });
      this.closeSession(session.sessionId, 'tencent connection closed');
    });
  }

  private flushPendingChunks(session: ClientSession) {
    if (
      !session.ready ||
      !session.clientWs ||
      session.tencentWs?.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    while (session.pendingChunks.length > 0) {
      const chunk = session.pendingChunks.shift();
      if (!chunk) continue;
      this.sendTencentChunk(session, chunk);
    }
    if (session.pendingComplete) {
      session.pendingComplete = false;
      session.tencentWs.send(
        JSON.stringify({
          session_id: session.sessionId,
          action: 'ACTION_COMPLETE',
        }),
      );
    }
  }

  private sendTencentChunk(session: ClientSession, chunk: string) {
    if (!session.tencentWs || session.tencentWs.readyState !== WebSocket.OPEN) {
      session.pendingChunks.push(chunk);
      return;
    }
    session.tencentWs.send(
      JSON.stringify({
        session_id: session.sessionId,
        message_id: crypto.randomUUID(),
        action: 'ACTION_SYNTHESIS',
        data: chunk,
      }),
    );
  }

  private sendClientJson(
    clientWs: WebSocket,
    payload: Record<string, unknown>,
  ): void {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    clientWs.send(JSON.stringify(payload));
  }

  private closeSession(sessionId: string, reason: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.closed = true;
    if (
      session?.tencentWs &&
      session.tencentWs.readyState < WebSocket.CLOSING
    ) {
      session.tencentWs.close();
    }
    if (session.clientWs.readyState < WebSocket.CLOSING) {
      session.clientWs.close();
    }
    this.sessions.delete(sessionId);
    this.logger.log(`[CLOSE] TTS ws closed: ${sessionId}, reason: ${reason}`);
  }

  private buildTtsWsUrl(sessionId: string) {
    const now = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = {
      Action: 'TextToStreamAudioWSv2',
      AppId: this.appId,
      Codec: 'mp3',
      Expired: now + 3600,
      SampleRate: 16000,
      SecretId: this.secretId,
      SessionId: sessionId,
      Speed: 0,
      Timestamp: now,
      VoiceType: this.voiceType,
      Volume: 5,
    };
    const signStr = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;
    const signature = createHmac('sha1', this.secretKey)
      .update(rawStr)
      .digest('base64');
    const searchParams = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      Signature: signature,
    });

    return `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`;
  }
}
