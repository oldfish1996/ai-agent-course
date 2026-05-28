import "dotenv/config";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MetricType } from "@zilliz/milvus2-sdk-node";
import { ChatOpenAI } from "@langchain/openai";

const COLLECTION_NAME = "ebook_collection";
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
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

async function retrieveRelevantContent(question: string, k: number = 3) {
  try {
    const queryVector = await getEmbedding(question);
    const searchResult = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ["id", "book_id", "chapter_num", "index", "content"],
    });
    return searchResult.results;
  } catch (error) {
    console.error("回答出错:", error);
    return [];
  }
}

async function answerEbookQuestion(question: string, k: number = 3) {
  try {
    console.log("=".repeat(80));
    console.log(`问题：${question}`);
    console.log("=".repeat(80));

    // 1.检索相关内容
    console.log("【正在检索相关内容】");
    const retrievedContent = await retrieveRelevantContent(question, k);
    if (retrievedContent.length === 0) {
      console.log("未找到相关内容");
      return "抱歉，我没有找到相关的《天龙八部》内容。";
    }
    // 2.打印检索到的内容和相似度
    retrievedContent.forEach((item, index) => {
      console.log(`[片段 ${index + 1}] 相似度： ${item.score} `);
      console.log(`  书籍：${item.book_id}`);
      console.log(`  章节：第${item.chapter_num}章`);
      console.log(`  片段索引：第${item.index}章`);
      console.log(`  内容：${item.content.substring(0, 100)}...`);
    });

    // 构建上下文
    const context = retrievedContent
      .map((item, index) => {
        return `[片段 ${index + 1}]
      章节：第${item.chapter_num}章
      内容：${item.content}
      `;
      })
      .join("\n\n");

    // 4.构建prompt
    const prompt = `你是一个专业的小说阅读助手，基于小说内容，用详细准确的语言回答问题。
    请根据以下小说片段回答下面的问题：
    ${context}

    用户问题: ${question}

    回答要求：
    1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
    2. 可以综合多个片段的内容，提供完整的答案
    3. 如果片段中没有相关信息，请如实告知用户
    4. 回答要准确，符合小说的情节和人物设定
    5. 可以引用原文内容来支持你的回答

    AI助手的回答：
    `;

    // 5.调用LLM回答
    console.log("=".repeat(80));
    console.log("\nAI 回答\n");
    const response = await model.invoke(prompt);
    console.log(response.content);
    console.log("\n");
  } catch (error) {
    console.log(error);
  }
}

async function main() {
  try {
    console.log("连接到 Milvus...");
    await client.connectPromise;
    console.log("✅连接  Milvus 成功");

    // 确保集合已记载
    try {
      await client.loadCollection({ collection_name: COLLECTION_NAME });
      console.log("✅集合已加载");

      // 问题
      // await answerEbookQuestion("乔峰会哪些武功？");
      await answerEbookQuestion("段誉和王语嫣最后怎么样了？");
    } catch (error) {
      // 如果已经加载，会报错，忽略即可
      if (!error.message.includes("already loaded")) {
        throw error;
      }
      console.log("✓ 集合已处于加载状态\n");
    }
  } catch (error) {
    console.log(error);
  }
}

main();
