import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v3";
import chalk from "chalk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const scientistSchema = z
  .object({
    name: z.string().describe("科学家的全名"),
    birth_year: z.number().describe("出生年份"),
    field: z.string().describe("主要研究领域"),
    achievements: z.array(z.string()).describe("主要成就列表"),
  })
  .strict();

const nativeJsonSchema = zodToJsonSchema(scientistSchema);

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  modelKwargs: {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scientist_info",
        strict: true,
        schema: nativeJsonSchema,
      },
    },
  },
});

async function main() {
  console.log(chalk.bgMagenta("🧪 测试原生 JSON Schema 模式"));

  const res = await model.invoke([
    new SystemMessage("你是一个信息提取助手，请直接返回 JSON 数据"),
    new HumanMessage("请介绍一下伽罗瓦"),
  ]);

  console.log(chalk.green(`收到响应(JSON): ${res.content}`));
}

main().catch(console.error);
