import "dotenv/config";
import tencentcloud from "tencentcloud-sdk-nodejs";
import fs from "node:fs";

const ttsClient = tencentcloud.tts.v20190823.Client;

const client = new ttsClient({
  credential: {
    secretId: process.env.SECRET_ID, // 替换为你的 SecretId
    secretKey: process.env.SECRET_KEY, // 替换为你的 SecretKey
  },
  region: "ap-guangzhou",
  profile: {
    httpProfile: {
      endpoint: "tts.tencentcloudapi.com",
    },
  },
});

const params = {
  Text: "苍茫的天涯是我的爱，连绵的青山脚下花正开",
  SessionId: "session-" + Date.now(), // 请求唯一标识
  ModelType: 1, // 模型类型：1=默认模型
  VoiceType: 603004, // 音色：101001=亲和女声，详见文档
  Volume: 0, // 音量，范围 [0,10]，0 为默认
  Speed: 0, // 语速，范围 [-2,2]，0 为默认
  SampleRate: 16000, // 采样率：16000 或 8000
  Codec: "mp3", // 音频编码：mp3 / wav / pcm
};

const result = await client.TextToVoice(params);
console.log("请求ID:", result.RequestId);

const outputFilePath = "output.mp3";

// 返回的音频数据为 Base64 编码
const audioBase64 = result.Audio;
if (!audioBase64) {
  throw new Error("腾讯云 TTS 响应中没有音频数据");
}
console.log("音频长度:", audioBase64.length, "字符");

// 如需保存为文件，可将 Base64 解码后写入
const audioBuffer = Buffer.from(audioBase64, "base64");
fs.writeFileSync(outputFilePath, audioBuffer);
console.log(`音频已保存到 ${outputFilePath}`);
