import "dotenv/config";
import { RunnableBranch, RunnableLambda } from "@langchain/core/runnables";

const isPositive = RunnableLambda.from((input: number) => input > 0);
const isNegative = RunnableLambda.from((input: number) => input < 0);
const isEven = RunnableLambda.from((input: number) => input % 2 === 0);

const handlePositive = RunnableLambda.from(
  (input: number) => `正数：${input + 1}`,
);

const handleNegative = RunnableLambda.from(
  (input: number) => `负数：${input - 1}`,
);
const handleEven = RunnableLambda.from((input: number) => `偶数：${input * 2}`);
const handleDefault = RunnableLambda.from((input: number) => `默认：${input}`);

// 相当于 if/else
const runableBranch = RunnableBranch.from<number, string>([
  [isPositive, handlePositive],
  [isNegative, handleNegative],
  [isEven, handleEven],
  handleDefault,
]);

const test = [1, -2, 3, 0];

for (const item of test) {
  const result = await runableBranch.invoke(item);
  console.log(`输入: ${item}, 输出: ${result}`);
}