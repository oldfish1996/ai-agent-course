import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "姓名",
  birth_year: "出生年份",
  nationality: "国籍",
  major_achievements: "主要成就，数组",
  famous_theory: "著名理论",
});

const question = `请介绍一下爱因斯坦的信息。${parser.getFormatInstructions()}`;

try {
  console.log(question);
  const response = await model.invoke(question);
  console.log(`原始响应: ${response.content}`);

  const result = await parser.parse(response.content as string);
  console.log("✅ StructuredOutputParser 自动解析的结果:\n");
  console.log(result);
  console.log(`姓名: ${result.name}`);
  console.log(`出生年份: ${result.birth_year}`);
  console.log(`国籍: ${result.nationality}`);
  console.log(`著名理论: ${result.famous_theory}`);
  console.log(`主要成就:`, result.major_achievements);
} catch (error) {
  console.error("Error:", error);
}
