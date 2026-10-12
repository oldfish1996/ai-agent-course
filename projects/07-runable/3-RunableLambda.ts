import "dotenv/config";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const addOne = RunnableLambda.from((input: number) => {
  console.log(`输入: ${input}`);
  return input + 1;
});

const multiplyByTwo = RunnableLambda.from((input: number) => {
  console.log(`输入: ${input}`);
  return input * 2;
});

const chain = RunnableSequence.from([addOne, multiplyByTwo, addOne]);

const res = await chain.invoke(5);
console.log(res);

console.log("=".repeat(50));

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const normalizeInput = RunnableLambda.from(
  async (input: { question: string }) => {
    return {
      question: input.question.trim(),
      timeAt: new Date().toISOString(),
    };
  },
);

const propmt = ChatPromptTemplate.fromMessages([
  ["system", "你是一名技术导师"],
  ["human", "{question}"],
]);

const chain2 = normalizeInput
  .pipe(propmt)
  .pipe(model)
  .pipe(new StringOutputParser());

const answer = await chain2.stream({ question: "什么是Runnable" });
for await (const chunk of answer) {
  process.stdout.write(chunk as string);
}
