import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

async function inMemoryChat() {
  // 1. 初始化聊天历史记录
  const history = new InMemoryChatMessageHistory();
  const systemMessage = new SystemMessage({
    content: "你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。",
  });

  console.log("[第一轮对话]");
  const userMsg1 = new HumanMessage({
    content: "你今天吃的什么？",
  });
  await history.addMessage(userMsg1);

  const message1 = [systemMessage, ...(await history.getMessages())];
  const response1 = await model.invoke(message1);
  await history.addMessage(response1);

  console.log("用户:", userMsg1.content);
  console.log("AI 回答:", response1.content);

  console.log("[第二轮对话 - 基于历史记录]");
  const userMsg2 = new HumanMessage({
    content: "好吃吗？",
  });
  await history.addMessage(userMsg2);

  const message2 = [systemMessage, ...(await history.getMessages())];
  const response2 = await model.invoke(message2);
  await history.addMessage(response2);

  console.log("用户:", userMsg2.content);
  console.log("AI 回答:", response2.content);

  // 展示所有历史消息记录
  console.log("[所有历史消息记录]");
  const allMessages = await history.getMessages();
  console.log(`共 ${allMessages.length} 条消息记录`);
  
  allMessages.forEach((msg, index) => {
    const type = msg.type;
    const prefix = type === "human" ? "用户:" : "AI 回答:";
    console.log(`${index + 1}. ${prefix}${msg.content}`);
  });
}


inMemoryChat().catch(console.error);