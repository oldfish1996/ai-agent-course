import {
  RunnableSequence,
  RunnableLambda,
  RunnableEach,
} from "@langchain/core/runnables";

const toUpperCase = RunnableLambda.from((input: string) => input.toUpperCase());
const addGreeting = RunnableLambda.from((input: string) => `Hello, ${input}`);

const processItem = RunnableSequence.from([
  toUpperCase,
  addGreeting,
]);

// 循环
const chain = new RunnableEach({
  bound: processItem,
})

const input = ["chen", "li"];
const result = await chain.invoke(input);
console.log(result);