import "dotenv/config";
import { RunnableLambda, RunnableMap } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";

const addOne = RunnableLambda.from((input: { number: number }) => input.number + 1);
const multiplyByTwo = RunnableLambda.from((input: { number: number }) => input.number * 2);
const square = RunnableLambda.from((input: { number: number }) => input.number ** 2);

const greetingTemplate = PromptTemplate.fromTemplate("你好，{name}！");
const weatherTemplate = PromptTemplate.fromTemplate("天气是{weather}。");

// 并行执行
const runableMap = RunnableMap.from({
  // calc
  add: addOne,
  multiply: multiplyByTwo,
  square,

  // prompt
  greetingTemplate,
  weatherTemplate,
});

const input = {
  name: "张三",
  weather: "晴",
  number: 5,
}

const res = await runableMap.invoke(input);
console.log(res);