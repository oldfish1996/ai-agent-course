import "dotenv/config";
import { parse } from "path";
import {
  MilvusClient,
  DataType,
  MetricType,
  IndexType,
} from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { EPubLoader } from "@langchain/community/document_loaders/fs/epub";

const COLLECTION_NAME = "ebook_collection";
const VECTOR_DIM = 1024;
const CHUNK_SIZE = 500;
const EPUB_FILE = "./天龙八部.epub";

const BOOK_NAME = parse(EPUB_FILE).name;

const embedding = new OpenAIEmbeddings({
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
  const result = await embedding.embedQuery(text);
  return result;
}

async function ensureCollection() {
  try {
    const hasCollection = await client.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    if (!hasCollection.value) {
      console.log(`创建集合: ${COLLECTION_NAME}`);
      await client.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          {
            name: "id",
            data_type: DataType.VarChar,
            max_length: 100,
            is_primary_key: true,
          },
          { name: "book_id", data_type: DataType.VarChar, max_length: 100 },
          { name: "book_name", data_type: DataType.VarChar, max_length: 200 },
          { name: "chapter_num", data_type: DataType.Int32 },
          { name: "index", data_type: DataType.Int32 },
          { name: "content", data_type: DataType.VarChar, max_length: 10000 },
          { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM },
        ],
      });
      console.log("✓ 集合创建完成");

      // 创建索引
      console.log("创建向量索引...");
      await client.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: "vector",
        index_type: IndexType.IVF_FLAT,
        metric_type: MetricType.COSINE,
        params: {
          nlist: 1024,
        },
      });
      console.log("✓ 向量索引创建完成");
    }

    try {
      await client.loadCollection({
        collection_name: COLLECTION_NAME,
      });
      console.log("✓ 集合加载完成");
    } catch (err) {
      console.log("集合正在加载中");
    }
  } catch (error) {
    console.error("创建集合时出错:", error);
    throw error;
  }
}

// 文档块批量插入到 Milvus
async function insertChunksBatch(chunks, bookId, chapterNum) {
  try {
    if (chunks.length === 0) {
      return 0;
    }
    //
    const insertData = await Promise.all(
      chunks.map(async (chunk, index) => {
        const vector = await getEmbedding(chunk);
        return {
          id: `${bookId}_${chapterNum}_${index}`,
          book_id: bookId.toString(),
          book_name: BOOK_NAME,
          chapter_num: chapterNum,
          index: index,
          content: chunk,
          vector: vector,
        };
      }),
    );

    // 插入数据
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: insertData,
    });
    console.log(`✓ 插入完成，共 ${insertData.length} 条数据`);
    return Number(insertResult.insert_cnt) || 0;
  } catch (error) {
    console.error(`插入章节 ${chapterNum} 的数据时出错:`, error.message);
    console.error("错误详情:", error);
    throw error;
  }
}

async function loadAndProcessEPubStreaming(bookId: number) {
  try {
    console.log(`\n开始加载 EPUB 文件: ${EPUB_FILE}`);
    const loader = new EPubLoader(EPUB_FILE, { splitChapters: true });
    const documents = await loader.load();
    console.log(`✓ 加载完成，共 ${documents.length} 个章节\n`);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: 50,
    });

    let totalInserted = 0;
    // 遍历每个章节，进行二次拆分并插入
    for (
      let chapterIndex = 0;
      chapterIndex < documents.length;
      chapterIndex++
    ) {
      const chapter = documents[chapterIndex];
      const chapterContent = chapter.pageContent;
      console.log(`处理第 ${chapterIndex + 1}/${documents.length} 章...`);
      // 对章节内容进行二次拆分
      const chunks = await textSplitter.splitText(chapterContent);
      console.log(`拆分完成，共 ${chunks.length} 个片段`);
      if (chunks.length === 0) {
        console.log("跳过空章节");
        continue;
      }
      console.log(`生成向量并插入中...`);
      const insertedCnt = await insertChunksBatch(
        chunks,
        bookId,
        chapterIndex + 1,
      );
      totalInserted += insertedCnt;
      console.log(`  已插入 ${insertedCnt} 条数据`);
      console.log(`  总插入 ${totalInserted} 条数据`);
    }
  } catch (error) {
    console.error("加载 EPUB 文件时出错:", error);
    throw error;
  }
}

async function main() {
  try {
    console.log("=".repeat(80));
    console.log("电子书处理程序");
    console.log("=".repeat(80));

    // 连接Milvus
    await client.connectPromise;
    console.log("✓ Connected\n");

    const bookId = 1;

    // 确保集合存在
    await ensureCollection();

    // 加载和处理 EPUB 文件（流式处理，边处理边插入）
    await loadAndProcessEPubStreaming(bookId);
    console.log("=".repeat(80));
    console.log("处理完成！");
    console.log("=".repeat(80));
    //
  } catch (error) {
    console.error("\n错误:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
