import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const scientistInfoSchema = z.object({
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
    schema: scientistInfoSchema,
  },
]);

const parser = new JsonOutputToolsParser();
const chain = modelWithTool.pipe(parser);

try {
  const stream = await chain.stream("请介绍一下牛顿。");

  let lastContent = "";
  let finalResult = null;

  for await (const chunk of stream as AsyncGenerator<
    Array<{ args: z.infer<typeof scientistInfoSchema> }>
  >) {
    if (chunk.length > 0) {
      const toolCall = chunk[0];
      console.log(toolCall.args);
    }
  }
} catch (error) {
  console.error("错误:", error);
}
