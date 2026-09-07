import {
  RunnablePassthrough,
  RunnableLambda,
  RunnableMap,
} from "@langchain/core/runnables";

const passsthrough = new RunnablePassthrough<string>();

const test = await passsthrough.invoke("chen");
// console.log(test);

// 并行保留原始输入
const chain = RunnableMap.from({
  original: new RunnablePassthrough<number>(),
  doubled: RunnableLambda.from((input: number) => input * 2),
});
console.log(await chain.invoke(5));

// .assign
const chain2 = RunnablePassthrough.assign({
  doubled: (input: {num: number}) => input.num * 2,
});
console.log(await chain2.invoke({num: 5}));
