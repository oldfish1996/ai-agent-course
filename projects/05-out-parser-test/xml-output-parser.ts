import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { XMLOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const parser = new XMLOutputParser();

const question = `请提取以下文本中的人物信息：阿尔伯特·爱因斯坦出生于 1879 年，是一位伟大的物理学家。
${parser.getFormatInstructions()}`;

console.log(question);

try {
  const response = await model.invoke(question);
  console.log("原始响应:", response.content);
  const parsedResponse = await parser.parse(response.content);
  console.log("解析后的响应:", parsedResponse);
} catch (error) {
  console.error("错误:", error);
}
