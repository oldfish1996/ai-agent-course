import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { Tool } from "@langchain/core/tools";

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
    .array(
      z.object({
        award: z.string().describe("奖励名称"),
        year: z.number().describe("奖励年份"),
      }),
    )
    .describe("奖励，数组"),
  famous_theory: z.string().describe("著名理论"),
});

const modelWithTool = model.bindTools([
  {
    name: "scientist_info",
    description: "获取关于一位科学家的信息",
    schema: scientistSchema,
  },
]);

const response = await modelWithTool.invoke("请介绍一下爱因斯坦的信息。");

console.log("response.tool_calls:", response.tool_calls);

const result = response.tool_calls[0].args;

console.log("result:", result);
