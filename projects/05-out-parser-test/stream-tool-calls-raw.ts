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

const modelWithTool = model.bindTools([
  {
    name: "scientist_info",
    description: "获取科学家的信息",
    schema,
  },
]);

console.log("🌊 流式 Tool Calls 演示 - 直接打印原始 tool_calls_chunk\n");

try {
  const stream = await modelWithTool.stream("请介绍一下牛顿。");

  let chunkIndex = 0;
  for await (const chunk of stream) {
    chunkIndex++;
    if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
      process.stdout.write(chunk.tool_call_chunks[0].args);
    }
  }
} catch (error) {
  console.error("错误:", error);
}
