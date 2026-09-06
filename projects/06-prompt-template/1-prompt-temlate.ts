import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(`
你是一名{language}编程导师。

请向{level}开发者解释以下概念：
{topic}

要求：
- 使用中文
- 给出一个简短示例
`.trim());

const result = await prompt.format({
  language: "TypeScript",
  level: "初级",
  topic: "泛型",
});

console.log(result);

console.log("=".repeat(50));

// invoke() 则返回可以继续传给 LangChain 模型的 PromptValue
const promptValue = await prompt.invoke({
  language: "TypeScript",
  level: "初级",
  topic: "泛型",
});

console.log(promptValue);