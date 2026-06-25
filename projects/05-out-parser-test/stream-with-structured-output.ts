import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const schema = z.object({
  nationality: z.string().describe("国籍"),
  major_achievements: z.array(z.string()).describe("主要成就，数组"),
  awards: z
    .array(z.object({ award: z.string(), year: z.number() }))
    .describe("奖励，数组"),
  famous_theory: z.string().describe("著名理论"),
});

const structuredModel = model.withStructuredOutput(schema);

const prompt = `请介绍一下莫扎特。`;

try {
  const stream = await structuredModel.stream(prompt);

  let result = null;
  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount++;
    result = chunk;
    console.log(`[Chunk ${chunkCount}]`);
    console.log(JSON.stringify(chunk, null, 2));
  }

  console.log(`共接受 ${chunkCount} 个 chunk`);

  if (result) {
    console.log(result);
  }
} catch (error) {
  console.error("错误:", error);
}
