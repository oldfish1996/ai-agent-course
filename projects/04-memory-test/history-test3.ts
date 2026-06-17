import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
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

async function fileHistoryDemo() {
  const filePath = path.join(__dirname, "chat_history.json");
  const sessionId = "user_session_001";

  const systemMessage = new SystemMessage({
    content: "你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。",
  });

  const restoredHistory = new FileSystemChatMessageHistory({
    filePath,
    sessionId,
  });

  const restoredMessage = await restoredHistory.getMessages();
  console.log(`从文件中恢复 ${restoredMessage.length} 条消息记录`);

  restoredMessage.forEach((msg, index) => {
    const type = msg.type;
    const prefix = type === "human" ? "用户:" : "AI 回答:";
    console.log(`${index + 1}. ${prefix}${msg.content}`);
  });

  console.log("[继续对话]");
  const userMessageNext = new HumanMessage({
    content: "需要哪些食材？",
  });

  await restoredHistory.addMessage(userMessageNext);

  const message3 = [systemMessage, ...(await restoredHistory.getMessages())];
  const response3 = await model.invoke(message3);
  await restoredHistory.addMessage(response3);

  console.log("用户:", userMessageNext.content);
  console.log("AI 回答:", response3.content);

  console.log(`✅ 第三轮对话已记录，路径: ${filePath}`);
}

fileHistoryDemo().catch(console.error);
