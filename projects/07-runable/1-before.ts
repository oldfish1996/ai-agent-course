import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
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
  translation: z.string().describe("翻译后的英文文本"),
  keywords: z.array(z.string()).length(3).describe("3个关键词"),
});

const outputParser = StructuredOutputParser.fromZodSchema(schema);

const input = {
  text: "LangChain是一个强大的AI应用开发框架",
  format_instructions: outputParser.getFormatInstructions(),
};

const promptTemplate = PromptTemplate.fromTemplate(
  `将以下文本翻译成英文,然后总结为3个关键词。\n\n文本:{text}\n\n{format_instructions}`,
);

// 1.格式化prompt
const formattedPrompt = await promptTemplate.format(input);
// 2.调用模型
const response = await model.invoke(formattedPrompt);
// 3.解析
const result = await outputParser.invoke(response);
console.log(result);