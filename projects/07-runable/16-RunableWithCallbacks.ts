import { RunnableLambda } from "@langchain/core/runnables";

// callbacks：监听 Runnable 的开始、结束、出错，适合记录日志。
// 这里通过 withConfig({ callbacks }) 绑定回调，无需调用 withCallbacks。
const double = RunnableLambda.from((input: number) => {
  if (input < 0) {
    throw new Error("输入不能为负数");
  }
  return input * 2;
});

const doubleWithCallbacks = double.withConfig({
  runName: "数字翻倍",
  callbacks: [
    {
      // RunnableLambda 对应 Chain 生命周期回调。
      handleChainStart(_chain, inputs) {
        console.log("① 开始，输入：", inputs);
      },
      handleChainEnd(outputs) {
        console.log("② 结束，输出：", outputs);
      },
      handleChainError(error) {
        console.log("② 出错：", error.message);
      },
    },
  ],
});

// 成功：触发 Start → End，invoke 返回计算结果 6。
console.log("--- 成功示例 ---");
console.log("③ invoke 返回：", await doubleWithCallbacks.invoke(3));

// 失败：触发 Start → Error；错误回调只负责监听，不会吞掉异常。
console.log("--- 失败示例 ---");
try {
  await doubleWithCallbacks.invoke(-1);
} catch (error) {
  console.log("③ 调用方捕获：", (error as Error).message);
}

// 也可以只在某一次调用时传入回调：double.invoke(3, { callbacks: [...] })。
