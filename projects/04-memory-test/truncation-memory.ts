// Memory 截断

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import {
  HumanMessage,
  AIMessage,
  trimMessages,
} from "@langchain/core/messages";
import { getEncoding, Tiktoken } from "js-tiktoken";

// 1.按消息数量截断
async function truncateByMessageCount() {
  const history = new InMemoryChatMessageHistory();
  const maxMessages = 4;
  const messages = [
    { type: "human", content: "你好今天吃什么？" },
    { type: "ai", content: "你今天吃红烧肉" },
    { type: "human", content: "好吃吗？" },
    { type: "ai", content: "好吃" },
    { type: "human", content: "需要哪些食材？" },
    { type: "ai", content: "需要红烧肉,糖，大蒜，生姜..." },
    { type: "human", content: "需要哪些工具？" },
    { type: "ai", content: "需要锅,刀" },
  ];

  for (const msg of messages) {
    if (msg.type === "human") {
      await history.addMessage(new HumanMessage(msg));
    } else {
      await history.addMessage(new AIMessage(msg));
    }
  }

  let allMessages = await history.getMessages();

  const trimMessages = allMessages.slice(-maxMessages);

  console.log(`保留消息数量：${trimMessages.length}`);
  console.log(
    `保留消息内容：${trimMessages.map((msg) => `${msg.constructor.name} ${msg.content}`).join("\n")}`,
  );
}

// 计算消息数组的token
function countTokens(messages: any[], encoder: Tiktoken) {
  let total = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    total += encoder.encode(content).length;
  }
  return total;
}

// 2. 按token截断
async function truncateByTokenCount() {
  const history = new InMemoryChatMessageHistory();
  const maxTokens = 100;

  const enc = getEncoding("cl100k_base");

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

  const trimmedMessages = await trimMessages(allMessages, {
    maxTokens,
    tokenCounter: async (msgs) => countTokens(msgs, enc),
    strategy: "last", // 保留最新的消息
  });

  const totalTokens = countTokens(trimmedMessages, enc);
  console.log(`总tokens: ${totalTokens} / ${maxTokens}`);
  console.log(`保留消息数量：${trimmedMessages.length}`);
  console.log(
    `保留消息内容: ${trimmedMessages
      .map((msg) => {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        const tokens = enc.encode(content).length;
        return `${msg.constructor.name} (${tokens}tokens}) ${content}`;
      })
      .join("\n")}`,
  );
}

async function runAll() {
  console.log("按消息数量截断");
  console.log("-----------------");
  await truncateByMessageCount();
  console.log("-----------------");
  console.log("按token截断");
  console.log("-----------------");
  await truncateByTokenCount();
}
runAll().catch(console.error);
