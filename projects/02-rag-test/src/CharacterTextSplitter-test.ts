import "dotenv/config";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { getEncoding } from "js-tiktoken";

const logDocument = new Document({
  pageContent: `[2024-01-15 10:00:00] INFO: Application started
[2024-01-15 10:00:05] DEBUG: Loading configuration file
[2024-01-15 10:00:10] INFO: Database connection established
[2024-01-15 10:00:15] WARNING: Rate limit approaching
[2024-01-15 10:00:20] ERROR: Failed to process request
[2024-01-15 10:00:25] INFO: Retrying operation
[2024-01-15 10:00:30] SUCCESS: Operation completed`,
});

const logTextSplitter = new CharacterTextSplitter({
  separator: "\n",
  chunkSize: 100,
  chunkOverlap: 20,
});
const logChunks = await logTextSplitter.splitDocuments([logDocument]);
// console.log(logChunks);

const enc = getEncoding("cl100k_base");
// console.log(enc.encode(logChunks[0].pageContent).length);

logChunks.forEach((doc) => {
  console.log(doc);
  console.log("character length:", enc.encode(doc.pageContent).length);
  console.log("token length:", enc.encode(doc.pageContent).length);
});
