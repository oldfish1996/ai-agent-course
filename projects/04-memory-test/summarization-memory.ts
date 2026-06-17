import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  getBufferString,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

async function summarizeHistory(messages) {
  if (messages.length === 0) {
    return "";
  }
  const conversationText = getBufferString(messages, "用户", "助手");

  const summaryPrompt = `
  请总结以下对话内容，保留核心信息：
  ${conversationText}
  `;
  const summaryResponse = await model.invoke([
    new SystemMessage({ content: summaryPrompt }),
  ]);
  return summaryResponse.content;
}

async function summarizationMemoryDemo() {
  const history = new InMemoryChatMessageHistory();
  const maxMessages = 5;

  const messages = [
    { type: "human", content: "你好今天吃什么？" },
    { type: "ai", content: "你今天吃红烧肉" },
    { type: "human", content: "好吃吗？" },
    { type: "ai", content: "好吃 好吃 好吃" },
    { type: "human", content: "需要哪些食材？" },
    { type: "ai", content: "需要红烧肉,糖，大蒜，生姜..." },
    { type: "human", content: "需要哪些工具？" },
    { type: "ai", content: "需要锅,刀。。。。。。。。" },
  ];

  for (const msg of messages) {
    if (msg.type === "human") {
      await history.addMessage(new HumanMessage(msg));
    } else {
      await history.addMessage(new AIMessage(msg));
    }
  }

  let allMessages = await history.getMessages();
  console.log(`原始消息数量： ${allMessages.length}`);
  console.log(
    "原始消息： ",
    allMessages
      .map((msg) => `${msg.constructor.name} (${msg.content})`)
      .join("\n"),
  );

  if (allMessages.length > maxMessages) {
    const keepRecent = 2;

    const recentMessages = allMessages.slice(-keepRecent);
    const messageToSummarize = allMessages.slice(0, -keepRecent);

    console.log("💡历史消息过多，开始总结...");
    console.log(`将被总结的消息数量： ${messageToSummarize.length}`);
    console.log(`将被保留的消息数量： ${recentMessages.length}`);

    const summary = await summarizeHistory(messageToSummarize);
    console.log(`总结结果： ${summary}`);

    await history.clear();
    for (const mgs of recentMessages) {
      await history.addMessage(mgs);
    }
    await history.addMessage(new SystemMessage({ content: summary }));
    allMessages = await history.getMessages();
  } else {
    console.log("历史消息数量正常，无需总结");
  }
}

summarizationMemoryDemo().catch(console.error);
