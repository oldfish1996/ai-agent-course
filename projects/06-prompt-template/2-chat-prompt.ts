import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

// fromMessages() 支持消息模板和 [role, template] 形式的元组
const prompt = ChatPromptTemplate.fromMessages([
  {
    role: "system",
    content: `你是一名资深{language}工程师。
回答应准确、简洁，并优先提供可运行代码。`,
  },
  ["human", `请解释：{question}, 读者水平：{level}`],
]);

const promptValue = await prompt.invoke({
  language: "TypeScript",
  level: "中级",
  question: "interface 和 type 有什么区别？",
});

console.log(promptValue.messages);

console.log("-".repeat(50));

// MessagesPlaceholder 用于占位符，用于在提示中插入实际的消息内容
const prompt2 = ChatPromptTemplate.fromMessages([
  ["system", "你是一名客服助手，用户当前使用的是{product}"],

  // 插入历史消息
  new MessagesPlaceholder({ variableName: "history" }),

  ["human", "{question}"],
]);

const result2 = await prompt2.invoke({
  product: "专业版",
  history: [
    new AIMessage({ content: "我的账号无法登录" }),
    new HumanMessage({ content: "请问页面显示了什么错误？" }),
    new AIMessage({ content: "提示验证码已过期" }),
  ],
  question: "接下来应该怎么办？",
});

console.log(result2.messages);
