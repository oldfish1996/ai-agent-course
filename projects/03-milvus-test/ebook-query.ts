import "dotenv/config";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION_NAME = "ebook_collection";
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
    console.log("✓ 链接成功\n");

    try {
      await client.loadCollection({
        collection_name: COLLECTION_NAME,
      });
      console.log("✓ 加载集合成功\n");
    } catch (error) {
      // 如果已经加载，会报错，忽略即可
      if (!error.message.includes("already loaded")) {
        throw error;
      }
      console.log("✓ 集合已处于加载状态\n");
    }

    // 查询
    // const query = "段誉会哪些武功？";
    const query = "鸠摩智这个人怎么样？";
    console.log(`查询: ${query}`);
    const queryVector = await getEmbedding(query);

    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: 3,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "book_id", "chapter_num", "index", "content"],
    });
    console.log(`找到 ${searchResult.results.length} 条记录`);
    searchResult.results.forEach((item, index) => {
      console.log(`${index + 1}. [Score: ${item.score.toFixed(4)}]`);
      console.log(`  ID:${item.id}`);
      console.log(`  Book ID:${item.book_id}`);
      console.log(`  Chapter: 第 ${item.chapter_num} 章`);
      console.log(`  Index:${item.index}`);
      console.log(`  Content:${item.content}\n`);
    });
  } catch (error) {
    console.error("Failed to answer the question:", error);
  }
}

main();
