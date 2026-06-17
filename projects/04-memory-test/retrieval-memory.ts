import "dotenv/config";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const COLLECTION_NAME = "conversation";
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.EMBEDDINGS_API_KEY,
  configuration: {
    baseURL: process.env.EMBEDDINGS_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

const client = new MilvusClient({
  address: "localhost:19530",
});

async function getEmbedding(text: string) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function retrievalRelavantConversations(query: string, k = 2) {
  try {
    const queryVector = await getEmbedding(query);

    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "content", "round", "timestamp"],
    });

    return searchResult.results;
  } catch (error) {
    console.error("回答出错:", error);
    return [];
  }
}

async function retrievalMemory() {
  try {
    console.log("Connecting to Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");
  } catch (error) {
    console.error("连接Milvus失败:", error);
    return;
  }

  const history = new InMemoryChatMessageHistory();

  const conversations = [
    { input: "我之前提到的机器学习项目进展如何？" },
    { input: "我周末经常做什么？" },
    { input: "我的职业是什么？" },
  ];

  for (let i = 0; i < conversations.length; i++) {
    const { input } = conversations[i];
    const userMessage = new HumanMessage(input);
    console.log(`[第${i + 1}轮对话]`);
    console.log(`用户：${input}`);

    // 检索相关历史对话
    const retrievedConversations = await retrievalRelavantConversations(
      input,
      2,
    );

    let relavantHistory = "";

    if (retrievedConversations.length > 0) {
      retrievedConversations.forEach((conv, index) => {
        console.log(
          `[历史对话${index + 1}]: 相似度：${conv.score.toFixed(4)}，轮次${conv.round}，内容：${conv.content}`,
        );
      });

      // 构建上下文
      relavantHistory += retrievedConversations
        .map(
          (conv) =>
            `[历史对话${conv.round}]: 轮次${conv.round}，内容：${conv.content}`,
        )
        .join("\n");

      // 构建prompt
      const contextMessages = relavantHistory
        ? [
            new HumanMessage(
              `相关历史对话：${relavantHistory}， 用户问题：${input}`,
            ),
          ]
        : [userMessage];

      // 调用模型
      const response = await model.invoke(contextMessages);
      console.log(`模型回答：${response.content}`);
      history.addMessages([userMessage, response]);
      console.log("\n");

      // 对话保存到 Milvus
      const conversationText = `用户：${input}， 助手：${response.content}`;
      const conv_id = `conv_${Date.now()}_${i + 1}`;
      const convVector = await getEmbedding(conversationText);

      try {
        await client.insert({
          collection_name: COLLECTION_NAME,
          data: [
            {
              id: conv_id,
              vector: convVector,
              content: conversationText,
              round: i + 1,
            },
          ],
        });
        console.log(`对话${conv_id}已保存到Milvus`);
      } catch (error) {
        console.error("插入对话到Milvus失败:", error);
      }

      console.log(`助手：${response.content}`);
    } else {
      console.log("没有找到相关历史对话");
    }
  }
}


retrievalMemory().catch(console.error);