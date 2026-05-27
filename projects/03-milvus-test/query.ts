import "dotenv/config";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";
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
    console.log("Connecting to Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n");

    // 向量搜索
    console.log("Searching for similar diary entries...");
    const query = "我做饭或学习的日记";
    console.log(`Query: "${query}"\n`);

    const queryVector = await getEmbedding(query);
    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: 5,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "content", "date", "mood", "tags"],
    });
    console.log(`Found ${searchResult.results.length} similar diary entries:\n`);
    searchResult.results.forEach((result, index) => {
      console.log(`${index}.[Score: ${result.score.toFixed(4)}]`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Content: ${result.content}`);
      console.log(`   Date: ${result.date}`);
      console.log(`   Mood: ${result.mood}`);
      console.log(`   Tags: ${result.tags}`);
      console.log("\n");
    });
  } catch (error) {
    console.error("Failed to connect to Milvus:", error);
    return;
  }
}


main();