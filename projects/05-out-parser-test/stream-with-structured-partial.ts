import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
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

const parser = StructuredOutputParser.fromZodSchema(schema);

const prompt = `请介绍一下莫扎特。 ${parser.getFormatInstructions()}`;

try {
  const stream = await model.stream(prompt);

  let result = "";
  let chunkCount = 0;
  for await (const chunk of stream) {
    chunkCount++;
    result += chunk.content;

    process.stdout.write(chunk.content as string);
  }

  console.log(`共接受 ${chunkCount} 个 chunk`);
} catch (error) {
  console.error("错误:", error);
}
