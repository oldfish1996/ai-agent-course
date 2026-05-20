import "dotenv/config";
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const cheerioLoader = new CheerioWebBaseLoader(
  "https://juejin.cn/post/7233327509919547452",
  {
    selector: ".main-area p",
  },
);

const documents = await cheerioLoader.load();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400, // 每个文档的最大字符数
  chunkOverlap: 50, // 文档之间的重叠字符数
  separators: ["。", "！", "？"],
});

const splitDocuments = await textSplitter.splitDocuments(documents);

console.log(splitDocuments);
