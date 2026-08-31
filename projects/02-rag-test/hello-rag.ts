import "dotenv/config";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import chalk from "chalk";

const model = new ChatOpenAI({
  temperature: 0,
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
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
});

const documents = [
  new Document({
    pageContent: `chen是一名硕士毕业生，他2022年毕业于浙江大学`,
    metadata: {
      chapter: 1,
      character: "chen",
      type: "角色介绍",
      mood: "学历、专业",
    },
  }),
  new Document({
    pageContent: `chen 硕士毕业后进入字节跳动成为一名前端开发工程师`,
    metadata: {
      chapter: 2,
      character: "chen",
      type: "工作经历",
      mood: "工作经历",
    },
  }),
  new Document({
    pageContent: `chen生活中喜欢散步`,
    metadata: {
      chapter: 3,
      character: "chen",
      type: "爱好",
      mood: "爱好",
    },
  }),
];

const vectorStore = await MemoryVectorStore.fromDocuments(
  documents,
  embeddings,
);

// const retriever = vectorStore.asRetriever({
//   k: 1,
// });

const questions = ["chen在哪里毕业的？"];

for (const question of questions) {
  console.log("=".repeat(80));
  console.log(`问题: ${question}`);
  console.log("=".repeat(80));

  const scoredResults = await vectorStore.similaritySearchWithScore(
    question,
    2,
  );
  const retrievedDocs = scoredResults.map(([doc]) => doc);

  console.log("\n【检索到的文档及相似度评分】");
  scoredResults.forEach(([doc, similarity], i) => {
    console.log(`\n[文档 ${i + 1}] 相似度: ${similarity.toFixed(4)}`);
    console.log(`内容: ${doc.pageContent}`);
    console.log(
      `元数据: 章节=${doc.metadata.chapter}, 角色=${doc.metadata.character}, 类型=${doc.metadata.type}, 心情=${doc.metadata.mood}`,
    );
  });

  // 构建 prompt
  const context = retrievedDocs
    .map((doc, i) => `[片段${i + 1}]\n${doc.pageContent}`)
    .join("\n\n━━━━━\n\n");

  const prompt = `你是一个专业的问答助手，如果你不知道答案，直接回答暂无参考资料。

已知背景:
${context}

问题: ${question}

你的的回答:`;

console.log(chalk.blue(`prompt: ${prompt}`));

  console.log("\n【AI 回答】");
  const response = await model.invoke(prompt);
  console.log(response.content);
  console.log("\n");
}
