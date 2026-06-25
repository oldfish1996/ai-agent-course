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

const personSchema = z.object({
  name: z.string().describe("姓名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  major_achievements: z.array(z.string()).describe("主要成就，数组"),
  famous_theory: z.string().describe("著名理论"),
  awards: z
    .array(
      z.object({
        award: z.string().describe("奖励名称"),
        year: z.number().describe("奖励年份"),
      }),
    )
    .describe("奖励，数组"),
});

const parser = StructuredOutputParser.fromZodSchema(personSchema);

const question = `请介绍一下居里夫人（Marie Curie）的信息。
${parser.getFormatInstructions()}`;

console.log(`生成的提示词：\n ${question}`);

try {
  const response = await model.invoke(question);
  console.log(`原始响应: ${response.content}`);

  const result = await parser.parse(response.content as string);
  console.log("✅ StructuredOutputParser 自动解析的结果:\n");
  console.log(result);
  // console.log(`姓名: ${result.name}`);
  // console.log(`出生年份: ${result.birth_year}`);
  // console.log(`国籍: ${result.nationality}`);
  // console.log(`著名理论: ${result.famous_theory}`);
  // console.log(`主要成就:`, result.major_achievements);
  // console.log(`奖励:`, result.awards);
} catch (error) {
  console.error("Error:", error);
}
