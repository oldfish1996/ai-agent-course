import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import path from "node:path";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const __dirname = import.meta.dirname;

async function fileHistory() {
  // 指定存储文件的路径
  const filePath = path.join(__dirname, "chat_history.json");
  const sessionId = "user_session_001";

  const systemMessage = new SystemMessage({
    content: "你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。",
  });
  console.log("[第一轮对话]");
  const history = new FileSystemChatMessageHistory({
    filePath,
    sessionId,
  });
  const userMsg1 = new HumanMessage({
    content: "红烧肉怎么做？",
  });
  await history.addMessage(userMsg1);

  const message1 = [systemMessage, ...(await history.getMessages())];
  const response1 = await model.invoke(message1);
  await history.addMessage(response1);
  console.log("用户:", userMsg1.content);
  console.log("AI 回答:", response1.content);
  console.log(`✅ 第一轮对话已保存，路径: ${filePath}`);

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
  console.log(`✅ 第二轮对话已记录，路径: ${filePath}`);
}

fileHistory().catch(console.error);
