import "dotenv/config";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "ai_diary";
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.EMBEDDINGS_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
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

async function retrieveRelaventDiarys(question: string, k: number = 2) {
  try {
    const queryVector = await getEmbedding(question);

    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "content", "date", "mood", "tags"],
    });
    return searchResult.results;
  } catch (error) {
    console.error("Failed to connect to Milvus:", error);
    return [];
  }
}

async function answerDiaryQuestion(question: string, k: number = 2) {
  try {
    console.log("=".repeat(80));
    console.log(`问题: ${question}`);
    console.log("=".repeat(80));

    console.log("【检索相关日记】");
    const retrievedDiaries = await retrieveRelaventDiarys(question, k);
    if (retrievedDiaries.length === 0) {
      console.log("没有检索到相关日记");
      return "没有检索到相关日记";
    }
    retrievedDiaries.forEach((diary, index) => {
      console.log(`[日记 ${index + 1}]: 相似度: ${diary.score.toFixed(4)}`);
      console.log(`ID: ${diary.id}`);
      console.log(`内容: ${diary.content}`);
      console.log(`日期: ${diary.date}`);
      console.log(`心情: ${diary.mood}`);
      console.log(`标签: ${diary.tags}`);
      console.log("\n");
    });

    const context = retrievedDiaries
      .map((diary, i) => {
        return `[日记 ${i + 1}]\n${diary.content}
        日期: ${diary.date}
        心情: ${diary.mood}
        标签: ${diary.tags}
        内容: ${diary.content}`;
      })
      .join("\n\n━━━━━\n\n");

      const prompt = `你是一个温暖贴心的 AI 日记助手。基于用户的日记内容回答问题，用亲切自然的语言。
      请根据以下日记内容回答问题：

      已知背景:
      ${context}

      问题: ${question}

      回答要求：
        1. 如果日记中有相关信息，请结合日记内容给出详细、温暖的回答
        2. 可以总结多篇日记的内容，找出共同点或趋势
        3. 如果日记中没有相关信息，请温和地告知用户
        4. 用第一人称"你"来称呼日记的作者
        5. 回答要有同理心，让用户感到被理解和关心
    AI助手的回答:`;
    console.log("\n【AI 回答】");
    const response = await model.invoke(prompt);
    console.log(response.content);
    console.log("\n");
  } catch (error) {
    console.error("Failed to answer the question:", error);
    return "回答问题失败";
  }
}


async function main() {
  try {
    console.log("连接到Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");

    await answerDiaryQuestion("我最近做了什么让我感到快乐的事情?", 2);
  } catch (error) {
    console.error("Failed to answer the question:", error);
    return "回答问题失败";
  }
}

main();