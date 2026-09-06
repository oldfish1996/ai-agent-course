import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是一名技术文档作者。使用{language}回答，最多{maxPoints}个要点。",
  ],
  ["human", "{question}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const answer = await chain.stream({
  language: "中文",
  maxPoints: 3,
  question: "什么是依赖注入？",
});

for await (const chunk of answer) {
  process.stdout.write(chunk as string);
}
