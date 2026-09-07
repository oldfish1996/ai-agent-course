import { RunnableLambda } from "@langchain/core/runnables";

let attempt = 0;

const unstableRunnable = new RunnableLambda({
  func: async (input) => {
    attempt++;
    console.log(`Attempt ${attempt}`);
    if (Math.random() < 0.7) {
      console.log("Failed");
      throw new Error("Simulated error");
    }
    console.log("Success");
    return `Success ${attempt}`;
  },
});

const runnableWithRetry = unstableRunnable.withRetry({
  stopAfterAttempt: 5,
});

try {
  const result = await runnableWithRetry.invoke("演示 withRetry");
  console.log("✅成功", result);
} catch (error) {
  console.error("❌多次尝试后仍失败", error);
}
