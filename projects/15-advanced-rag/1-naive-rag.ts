import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Annotation, START, END, StateGraph } from "@langchain/langgraph";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import chalk from "chalk";
import "dotenv/config";

const COLLECTION_NAME = "ebook_collection";
const TOP_K = 5;

type Document = {
  score: number;
  id: string;
  book_id: string;
  content: string;
  chapter_num: string;
  index: string;
};

const GraphState = Annotation.Root({
  question: Annotation<string>(),
  k: Annotation<number>(),
  documents: Annotation<Document[]>(),
  generation: Annotation<string>(),
});

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

let vectorStore: Milvus;

async function retrieveDocuments(question: string, k: number = 5) {
  try {
    const docWithScores = await vectorStore.similaritySearchWithScore(
      question,
      k,
    );
    return docWithScores.map(([doc, score]) => ({
      score,
      id: doc.metadata?.id || "unknown",
      book_id: doc.metadata?.book_id || "",
      content: doc.pageContent,
      chapter_num: doc.metadata?.chapter_num || "unknown",
      index: doc.metadata?.index || "unknown",
    }));
  } catch (error) {
    console.error("Error retrieving documents:", error);
    return [];
  }
}

const retrieveNode = async (state: typeof GraphState.State) => {
  const documents = await retrieveDocuments(state.question, state.k);
  return { question: state.question, k: state.k, documents };
};

const generateNode = async (state: typeof GraphState.State) => {
  const context = state.documents
    .map(
      (doc, index) =>
        `[片段${index + 1}]
      章节${doc.chapter_num} 
      内容${doc.content}`,
    )
    .join("\n");

  const prompt = `你是一个专业的小说内容回答助手。
    请基于以下小说内容回答问题：
    ${context}
    问题: ${state.question}
    你的回答:`;

  let generation = "";
  const stream = await model.stream(prompt);
  for await (const chunk of stream) {
    const text = typeof chunk === "string" ? chunk : chunk.content;
    if (!text) continue;
    generation += text;
    process.stdout.write(chalk.blue(text));
  }
  process.stdout.write("\n");
  return {
    question: state.question,
    k: state.k,
    documents: state.documents,
    generation: generation.trim() || "无",
  };
};

const graph = new StateGraph(GraphState)
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .compile();

async function main() {
  const question = "阿朱最后的结局是什么";
  const k = 5;

  console.log((await graph.getGraphAsync()).drawMermaid({ withStyles: true }));

  console.log(chalk.bgGreen("连接到Milvus..."));
  vectorStore = await Milvus.fromExistingCollection(embeddings, {
    collectionName: COLLECTION_NAME,
    url: "http://localhost:19530",
    textField: "content",
    vectorField: "embedding",
    primaryField: "id",
    indexCreateOptions: {
      metric_type: "COSINE",
      index_type: "HNSW",
      params: { M: 16, ef_construction: 200 },
      search_params: { ef: 64 },
    },
  });
  vectorStore.indexSearchParams = {
    metric_type: "COSINE",
    params: JSON.stringify({ ef: 64 }),
  };
  console.log(chalk.bgGreen("连接到Milvus成功"));

  try {
    await vectorStore.client.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(chalk.bgGreen(`加载集合${COLLECTION_NAME}成功`));
  } catch (error) {
    if (!error.message.includes("already loaded")) {
      throw error;
    }
    console.log(chalk.bgGreen(`集合${COLLECTION_NAME}已加载`));
  }

  console.log(chalk.bgGreen(`问题：${question}`));
  const result = await graph.invoke({
    question,
    k,
    documents: [],
    generation: "",
  });

  if (result.documents.length === 0) {
    console.log(chalk.bgRed("未找到相关文档"));
    return;
  }
  result.documents.forEach((doc, i) => {
    console.log(`片段[${i + 1}] 相似度评分: ${doc.score.toFixed(4)}`);
    console.log(`章节${doc.chapter_num}`);
    console.log(`索引${doc.index}`);
    console.log(`内容${doc.content}`);
    console.log("\n");
  });

  if (!result.generation) {
    console.log(chalk.bgRed("未生成回答"));
    return;
  }
}
main().catch(console.error);
