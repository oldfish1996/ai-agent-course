import "dotenv/config";
import { RouterRunnable, RunnableLambda } from "@langchain/core/runnables";

const toUpperCase = RunnableLambda.from((input: string) => input.toUpperCase());
const reverse = RunnableLambda.from((input: string) =>
  input.split("").reverse().join(""),
);

// 相当于 switch 语句
const router = new RouterRunnable({
  runnables: {
    toUpperCase,
    reverse,
  },
});

const test1 = await router.invoke({
  key: "toUpperCase",
  input: "hello",
});
console.log(test1);

const test2 = await router.invoke({
  key: "reverse",
  input: "hello",
});
console.log(test2);
