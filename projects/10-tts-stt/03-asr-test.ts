import "dotenv/config";
import fs from "node:fs";
import tecencentcloud from "tencentcloud-sdk-nodejs";

const SECRET_ID = process.env.SECRET_ID;
const SECRET_KEY = process.env.SECRET_KEY;

const asrClinet = tecencentcloud.asr.v20190614.Client;

const client = new asrClinet({
  credential: {
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
  },
  region: "ap-shanghai",
  profile: {
    httpProfile: {
      reqTimeout: 30,
      reqMethod: "POST",
    },
  },
});

async function run() {
  const audioBase64 = fs.readFileSync("./output.mp3").toString("base64");
  const params = {
    EngSerViceType: "16k_zh",
    SourceType: 1,
    Data: audioBase64,
    DataLen: Buffer.byteLength(audioBase64),
    VoiceFormat: "mp3",
  };

  try {
    const data = await client.SentenceRecognition(params);
    console.log("识别结果:", data.Result);
  } catch (error) {
    console.error(error);
  }
}

run();
