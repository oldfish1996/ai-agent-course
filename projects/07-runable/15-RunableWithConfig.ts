import { RunnableLambda } from "@langchain/core/runnables";

// withConfig：为 Runnable 预设运行配置，返回一个新的 Runnable。
// input 是业务输入；config 是运行配置，两者分开传递。
const greet = RunnableLambda.from((name: string, config) => {
  // configurable 中的自定义参数，需要在函数里主动读取才会生效。
  const language = config?.configurable?.language ?? "zh";
  return language === "en" ? `Hello, ${name}!` : `你好，${name}！`;
});

const englishGreet = greet.withConfig({
  runName: "英文问候", // 运行名称，方便日志和追踪中识别
  tags: ["demo"], // 运行标签，用于追踪和筛选
  configurable: { language: "en" }, // 自定义业务配置
});

console.log(await greet.invoke("小明")); // 你好，小明！
console.log(await englishGreet.invoke("小明")); // Hello, 小明!

// invoke 的第二个参数可以覆盖这一次调用的预设配置。
console.log(
  await englishGreet.invoke("小明", {
    configurable: { language: "zh" },
  }),
); // 你好，小明！

// 单次覆盖不会修改 englishGreet 的预设配置。
console.log(await englishGreet.invoke("小明")); // Hello, 小明!
