import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  getBufferString,
} from "@langchain/core/messages";
import { getEncoding, Tiktoken } from "js-tiktoken";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

function countTokens(messages, encoder: Tiktoken) {
  let total = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string" ? msg.content : msg.content.join("\n");
    total += encoder.encode(content).length;
  }
  return total;
}

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
  const maxTokens = 50;
  const keepRecentTokens = 30;

  const encoder = getEncoding("cl100k_base");

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
  const totalTokens = countTokens(allMessages, encoder);
  console.log(`原始消息token数量: ${totalTokens}`);

  if (totalTokens > maxTokens) {
    // 从后往前累加消息，直到token数量小于等于maxTokens
    const recentMessages = [];
    let recentTokens = 0;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      const content =
        typeof msg.content === "string" ? msg.content : msg.content.join("\n");
      const msgTokens = encoder.encode(content).length;
      if (recentTokens + msgTokens <= maxTokens) {
        recentMessages.unshift(msg);
        recentTokens += msgTokens;
      } else {
        break;
      }
    }

    const messageToSummarize = allMessages.slice(
      0,
      allMessages.length - recentMessages.length,
    );
    const summarizeTokens = countTokens(messageToSummarize, encoder);

    console.log("💡 Token 数量超过阈值，开始总结...");
    console.log(
      `将被总结的消息数量: ${messageToSummarize.length} (${summarizeTokens} tokens)`,
    );
    console.log(
      `将被保留的消息数量: ${recentMessages.length} (${recentTokens} tokens)`,
    );

    const summary = await summarizeHistory(messageToSummarize);
    // console.log(`总结结果: ${summary}`);

    await history.clear();
    for (const msg of recentMessages) {
      await history.addMessage(msg);
    }

    console.log(`保留消息数量: ${recentMessages.length}`);
    console.log(
      "保留的消息：",
      recentMessages.map((msg) => {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : msg.content.join("\n");
        const tokens = encoder.encode(content).length;
        return `${msg.constructor.name}: ${content} (${tokens} tokens)`;
      }),
    );
    console.log(`被总结内容：${summary}`);
  } else {
    console.log("消息token数量未超过阈值，无需总结");
  }
}

summarizationMemoryDemo().catch(console.error);
