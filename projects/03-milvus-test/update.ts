import "dotenv/config";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "ai_diary";
const VECTOR_DIM = 1024;

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

async function main() {
  try {
    console.log("连接到Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");

    console.log("更新日记...");
    const updateId = "diary_001";
    const updatedContent = {
      id: updateId,
      content:
        "今天下了一整天的雨，心情很糟糕。工作上遇到了很多困难，感觉压力很大。一个人在家，感觉特别孤独。",
      date: "2026-01-10",
      mood: "sad",
      tags: ["生活", "散步", "朋友"],
    };
    console.log("Generating new embedding...");
    const vector = await getEmbedding(updatedContent.content);
    const updataData = {
      ...updatedContent,
      vector,
    };

    const result = await client.upsert({
      collection_name: COLLECTION_NAME,
      data: [updataData],
    });

    console.log(`✓ Updated diary entry: ${updateId}`);
    console.log(` New content: ${updatedContent.content}`);
    console.log(` New mood: ${updatedContent.mood}`);
    console.log(` New tags: ${updatedContent.tags.join(", ")}\n`);
  } catch (error) {
    console.error("Failed to answer the question:", error);
    return "回答问题失败";
  }
}
main();
