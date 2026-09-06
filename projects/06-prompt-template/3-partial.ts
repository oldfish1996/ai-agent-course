// 如果某些参数在一批调用中保持不变，可以先创建一个 partial template。

import { ChatPromptTemplate } from "@langchain/core/prompts";

const basePrompt = ChatPromptTemplate.fromMessages([
  ["system", "你是{team}团队的代码审查助手，默认编程语言是{language}。"],
  ["human", "请审查以下代码：\n {code}"],
]);

const fePrompt = await basePrompt.partial({
  team: "前端团队",
  language: "TypeScript",
});

const result = await fePrompt.invoke({
  code: `function divide(a: number, b: number) {
      return a / b;
    }`,
});

console.log(result.messages);