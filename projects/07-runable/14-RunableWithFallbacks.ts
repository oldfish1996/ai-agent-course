import { Runnable, RunnableLambda } from "@langchain/core/runnables";

const translate1 = RunnableLambda.from<string, string>(
  async (_text: string): Promise<string> => {
    console.log(`服务超时`);
    throw new Error("服务超时");
  },
);

const translate2 = RunnableLambda.from<string, string>(
  async (_text: string): Promise<string> => {
    console.log(`服务限流`);
    throw new Error("服务限流");
  },
);

const translateFallback = RunnableLambda.from<string, string>(
  async (_text: string): Promise<string> => {
    console.log(`翻译成功`);
    return `${_text} -> hello`;
  },
);

const translator: Runnable<string, string> = translate1.withFallbacks([
  translate2,
  translateFallback,
]);

const res = await translator.invoke("你好");
console.log(res);
