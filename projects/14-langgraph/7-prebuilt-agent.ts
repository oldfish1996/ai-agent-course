// import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool, createAgent, toolStrategy, HumanMessage } from "langchain";
import z from "zod";
import "dotenv/config";

const AnswerSchema = z.object({
  result: z.number().describe("计算结果"),
  explanation: z.string().describe("计算结果的解释"),
});

const multiply = tool(async ({ a, b }) => String(a * b), {
  name: "multiply",
  description: "Multiply two numbers together",
  schema: z.object({
    a: z.number(),
    b: z.number(),
  }),
});

const tools = [multiply];

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 不需要bindTools
const agent = createAgent({
  model,
  tools,
  systemPrompt:
    "你是一个智能助手,可以在需要时调用工具(如multiply)来计算乘法结果,再用结果回答用户的问题。",
  checkpointer: new MemorySaver(),
  responseFormat: toolStrategy(AnswerSchema),
});

const drawable = await agent.graph.getGraphAsync();
const mermaid = await drawable.drawMermaid();
console.log(mermaid);

// createAgent 就不需要再手动添加节点和边了
async function main() {
  const config = {
    configurable: { thread_id: "conv-001" },
    recursionLimit: 20,
  };

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("请使用乘法工具计算 12*3")],
    },
    config,
  );
  // console.log(result.messages.at(-1)?.content);
  console.log(result.structuredResponse);

  const next = await agent.invoke(
    {
      messages: [new HumanMessage("把刚才的结果再除以 4")],
    },
    config,
  );
  // console.log(next.messages.at(-1)?.content);
  console.log(next.structuredResponse);
}

main().catch(console.error);
