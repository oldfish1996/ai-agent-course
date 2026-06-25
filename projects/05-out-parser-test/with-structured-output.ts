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

const scientistSchema = z.object({
  name: z.string().describe("姓名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  major_achievements: z.array(z.string()).describe("主要成就，数组"),
  awards: z
    .array(z.object({ award: z.string(), year: z.number() }))
    .describe("奖励，数组"),
  famous_theory: z.string().describe("著名理论"),
});

const structuredModel = model.withStructuredOutput(scientistSchema);

const result = await structuredModel.invoke("请介绍一下爱因斯坦的信息。");

console.log(result);
