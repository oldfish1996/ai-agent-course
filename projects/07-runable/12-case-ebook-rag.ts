import "dotenv/config";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MilvusClient, MetricType } from "@zilliz/milvus2-sdk-node";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import chalk from "chalk";

type RetrievedContent = {
  id: number;
  book_id: string;
  chapter_num: number;
  index: number;
  content: string;
  score: number;
};

type RAGInput = {
  question: string;
  retrievedContent?: RetrievedContent[];
  context?: string;
  hasContext?: boolean;
  k?: number;
  noContext?: boolean;
  answer?: string;
};

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

const milvusClient = new MilvusClient({
  address: "localhost:19530",
});

const milvusSearch = new RunnableLambda({
  func: async (input: RAGInput) => {
    const { question, k = 5 } = input;
    try {
      // 1.生成问题向量
      const queryVector = await embeddings.embedQuery(question);
      // 2.调用Milvus搜索
      const searchResult = await milvusClient.search({
        collection_name: COLLECTION_NAME,
        vector: queryVector,
        limit: k,
        metric_type: MetricType.COSINE,
        output_fields: ["id", "book_id", "chapter_num", "index", "content"],
      });
      const results = searchResult.results ?? [];
      const retrievedContent = results.map((item, idx) => ({
        id: item.id,
        book_id: item.book_id,
        chapter_num: item.chapter_num,
        index: item.index,
        content: item.content,
        score: item.score,
      }));
      return { question, retrievedContent };
    } catch (error) {
      console.error("检索出错:", error);
      return { question, retrievedContent: [] };
    }
  },
});

// PromptTemplate

const promptTemplate = PromptTemplate.fromTemplate(
  `你是一个专业的小说阅读助手，基于小说内容回答问题，用准确详细的语言。
  请根据以下小说片段内容回答问题：
  {context}
  用户问题：{question}
  回答要求：
   1.如果片段中有相关信息,请结合小说内容给出详细、准确的回答
    2.可以综合多个片段的内容,提供完整的答案
    3.如果片段中没有相关信息,请如实告知用户
    4.回答要准确,符合小说的情节和人物设定
    5.可以引用原文内容来支持你的回答
    
    AI回答：`,
);

// 构建context + 日志打印的Runnable
const buildPromptInput = new RunnableLambda({
  func: (input: RAGInput) => {
    const { question, retrievedContent } = input;
    if (retrievedContent.length === 0) {
      return {
        hasContext: false,
        context: "",
        question,
        retrievedContent,
      };
    }

    // 打印检索结果
    console.log("=".repeat(80));
    console.log(chalk.bgBlue(`问题：${question}`));
    console.log("=".repeat(80));
    console.log(chalk.bgGreen(`检索到的内容`));
    retrievedContent.forEach((item, index) => {
      console.log(`[片段 ${index + 1}] 相似度： ${item.score} `);
      console.log(`  书籍：${item.book_id}`);
      console.log(`  章节：第${item.chapter_num}章`);
      console.log(`  片段索引：第${item.index}章`);
      console.log(`  内容：${item.content.substring(0, 100)}...`);
    });

    const context = retrievedContent
      .map((item, index) => {
        return `[片段 ${index + 1}]
        章节：第${item.chapter_num}章
        内容：${item.content}
        `;
      })
      .join("\n\n");
    return {
      hasContext: true,
      context,
      question,
      retrievedContent,
    };
  },
});

// 组合成完整的 RAG Runnable (检索 -> 构建Prompt输入 -> PromptTemplate -> LLM -> 文本)
const ragChain = RunnableSequence.from([
  milvusSearch,
  buildPromptInput,
  new RunnableLambda({
    func: (input: RAGInput) => {
      const { question, context, hasContext } = input;
      if (!hasContext) {
        const fallback = "根据用户问题，没有找到相关的小说内容。";
        return {
          question,
          context: "",
          answer: fallback,
          noContext: true,
        };
      }
      return {
        question,
        context,
        noContext: false,
      };
    },
  }),
  promptTemplate,
  model,
  new StringOutputParser(),
]);

async function initMilvusCollection() {
  console.log("初始化Milvus集合");
  await milvusClient.connectPromise;
  console.log("✓ 链接成功\n");

  try {
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log("✓ 加载集合成功\n");
  } catch (error) {
    // 如果已经加载，会报错，忽略即可
    if (!error.message.includes("already loaded")) {
      throw error;
    }
    console.log("✓ 集合已加载\n");
  }
}

async function main() {
  try {
    await initMilvusCollection();
    const input: RAGInput = {
      question: "鸠摩智会哪些武功",
      k: 3,
    };
    const stream = await ragChain.stream(input);
    for await (const chunk of stream) {
      process.stdout.write(chalk.greenBright(chunk));
    }
  } catch (error) {
    console.error(error);
  }
}

await main();
