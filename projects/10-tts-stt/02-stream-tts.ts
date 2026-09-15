import "dotenv/config";
import WebSocket from "ws";
import crypto from "node:crypto";
import fs from "node:fs";
/**
 * 腾讯云流式文本语音合成 (TextToStreamAudioWSv2) - Node.js 示例
 *
 * 环境要求: Node.js >= 12，安装 ws 和 crypto 模块
 * 安装依赖: npm install ws
 */

// ==================== 配置参数（请替换为实际值）====================
const APP_ID = process.env.APP_ID; // 腾讯云 AppId
const SECRET_ID = process.env.SECRET_ID; // 腾讯云 SecretId
const SECRET_KEY = process.env.SECRET_KEY; // 腾讯云 SecretKey
const VOICE_TYPE = 101001; // 音色 ID
const SAMPLE_RATE = 16000; // 采样率: 8000 / 16000 / 24000
const CODEC = "mp3"; // 音频格式: pcm / mp3
const SPEED = 0; // 语速: [-2, 6]，0 为正常
const VOLUME = 0; // 音量: [-10, 10]，0 为正常

const OUT_PUT_FILE = "output2.mp3";

// ==================== 签名生成 ====================
function generateSignature(params, secretKey) {
  const keys = Object.keys(params).sort();
  const queryString = keys.map((key) => `${key}=${params[key]}`).join("&");
  const signSource = `GETtts.cloud.tencent.com/stream_wsv2?${queryString}`;
  const hmac = crypto.createHmac("sha1", secretKey);
  hmac.update(signSource);
  return hmac.digest().toString("base64");
}

// ==================== 构建 WebSocket URL ====================
function buildWebSocketUrl() {
  const sessionId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );

  const now = Math.floor(Date.now() / 1000);
  const expired = now + 3600; // 有效期 1 小时

  const params: Record<string, string | number | boolean> = {
    Action: "TextToStreamAudioWSv2",
    AppId: APP_ID,
    Codec: CODEC,
    Expired: expired,
    SampleRate: SAMPLE_RATE,
    SecretId: SECRET_ID,
    SessionId: sessionId,
    Speed: SPEED,
    Timestamp: now,
    VoiceType: VOICE_TYPE,
    Volume: VOLUME,
  };

  const signature = generateSignature(params, SECRET_KEY);
  params.Signature = signature;

  const queryString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`)
    .join("&");

  return {
    url: `wss://tts.cloud.tencent.com/stream_wsv2?${queryString}`,
    sessionId,
  };
}

// ==================== 核心流程 ====================
function streamTTS(textChunks) {
  const { url, sessionId } = buildWebSocketUrl();
  const audioChunks = [];
  let textIndex = 0;
  let sendStarted = false;

  console.log(`[INFO] SessionId: ${sessionId}`);
  const ws = new WebSocket(url);

  function sendTextChunks() {
    if (sendStarted) {
      return;
    }
    sendStarted = true;

    const timer = setInterval(() => {
      if (textIndex >= textChunks.length) {
        clearInterval(timer);
        ws.send(
          JSON.stringify({
            session_id: sessionId,
            message_id: crypto.randomUUID(),
            action: "ACTION_COMPLETE",
            data: "",
          }),
        );
        console.log("[INFO] 所有文本已发送完毕，已发送结束指令");
        return;
      }

      const chunk = textChunks[textIndex];
      ws.send(
        JSON.stringify({
          session_id: sessionId,
          message_id: crypto.randomUUID(),
          action: "ACTION_SYNTHESIS",
          data: chunk,
        }),
      );
      console.log(
        `[SEND] (${textIndex + 1}/${textChunks.length}) ${chunk.length > 40 ? chunk.substring(0, 40) + "..." : chunk}`,
      );
      textIndex++;
    }, 300);
  }

  // ----- 连接建立，等待服务端就绪 -----
  ws.on("open", () => {
    console.log("[INFO] 连接已建立，等待服务端就绪...");
  });

  // ----- 接收消息 -----
  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      // 二进制帧：音频数据
      audioChunks.push(data);
      console.log(
        `[AUDIO] 收到音频片段: ${(data.length / 1024).toFixed(1)} KB`,
      );
    } else {
      // 文本帧：JSON 事件
      const msg = JSON.parse(data.toString());
      const { code, message, ready, final, heartbeat, result } = msg;

      if (code !== 0) {
        console.error(`[ERROR] code=${code}, message=${message}`);
        return;
      }

      if (ready === 1) {
        console.log("[EVENT] READY - 服务端就绪");
        sendTextChunks();
      } else if (heartbeat === 1) {
        // 心跳，可忽略
      } else if (final === 1) {
        console.log("[EVENT] FINAL - 合成结束");
        ws.close();
      } else if (result && result.subtitles) {
        const text = result.subtitles.map((s) => s.Text).join("");
        const start = (result.subtitles[0].BeginTime / 1000).toFixed(1);
        const end = (
          result.subtitles[result.subtitles.length - 1].EndTime / 1000
        ).toFixed(1);
        console.log(`[RESULT] "${text}" (${start}s ~ ${end}s)`);
      }
    }
  });

  // ----- 错误与关闭 -----
  ws.on("error", (err) => console.error("[ERROR]", err.message));

  ws.on("close", (code) => {
    console.log(`[INFO] 连接关闭 (code=${code})`);
    if (audioChunks.length > 0) {
      fs.writeFileSync(OUT_PUT_FILE, Buffer.concat(audioChunks));
      console.log(`[INFO] 音频已保存至: ${OUT_PUT_FILE}`);
    } else {
      console.log("[INFO] 未收到音频数据");
    }
  });
}

// ==================== 使用示例 ====================
const texts = [
  "欢迎使用腾讯云语音合成服务。",
  "本接口采用 WebSocket 协议，支持流式文本输入。",
  "适用于大语言模型的逐字输出场景。",
  "感谢您的使用，祝您开发愉快！",
];

streamTTS(texts);
