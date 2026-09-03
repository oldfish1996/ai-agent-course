import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const prompt = `请介绍一下三国的袁术。`;

try {
  const stream = await model.stream(prompt);

  let fullResponse = "";
  let chunkCount = 0;
  for await (const chunk of stream) {
    fullResponse += chunk.content;
    chunkCount++;
    process.stdout.write(chunk.content as string);
  }

  console.log(chalk.blue(`\n[总 chunk 数量] ${chunkCount}`));
  console.log(chalk.green(`[总响应长度] ${fullResponse.length}`));
} catch (error) {
  console.error("错误:", error);
}
