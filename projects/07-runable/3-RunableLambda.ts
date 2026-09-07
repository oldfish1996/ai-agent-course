import "dotenv/config";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

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
