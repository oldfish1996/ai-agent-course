import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

import { RunnableSequence } from "@langchain/core/runnables";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const schema = z.object({
  translation: z.string().describe("翻译后的英文文本"),
  keywords: z.array(z.string()).length(3).describe("3个关键词"),
});

const outputParser = StructuredOutputParser.fromZodSchema(schema);

const promptTemplate = PromptTemplate.fromTemplate(
  `将以下文本翻译成英文,然后总结为3个关键词。\n\n文本:{text}\n\n{format_instructions}`,
);

const input = {
  text: "LangChain是一个强大的AI应用开发框架",
  format_instructions: outputParser.getFormatInstructions(),
};

// 相当于串行执行
const chain = RunnableSequence.from([
  promptTemplate,
  model,
  outputParser,
]);

const chain2 = promptTemplate.pipe(model).pipe(outputParser);

const result = await chain.invoke(input);
console.log(result);

console.log("-----------------");
const result2 = await chain2.invoke(input);
console.log(result2);