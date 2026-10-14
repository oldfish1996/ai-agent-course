import { tool } from "@langchain/core/tools";
import {
  StateGraph,
  StateSchema,
  MessagesValue,
  MemorySaver,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "langchain";
import z from "zod";
import "dotenv/config";

const State = new StateSchema({
  // MessagesValue 内置了消息合并规则：新 ID 的消息追加，已有 ID 的消息替换
  messages: MessagesValue,
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
}).bindTools(tools);

// toolsCondition 的返回值是 "tools" ｜ END
// 如果 model 有 tool_calls，返回 "tools"，否则返回 END

const graph = new StateGraph(State)
  .addNode("model", async (state) => {
    const response = await model.invoke(state.messages);
    // 只返回新消息，由 MessagesValue 合并进历史
    return { messages: [response] };
  })
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "model")
  .addConditionalEdges("model", toolsCondition)
  .addEdge("tools", "model")
  .compile({ checkpointer: new MemorySaver() });

async function main() {
  const config = {
    configurable: { thread_id: "conv-001" },
    recursionLimit: 20,
  };

  const drawable = await graph.getGraphAsync();
  const mermaid = drawable.drawMermaid();
  console.log(mermaid);

  const result = await graph.invoke(
    {
      messages: [new HumanMessage("请使用乘法工具计算 12*3")],
    },
    config,
  );
  console.log(result.messages.at(-1)?.content);

  const next = await graph.invoke(
    {
      messages: [new HumanMessage("把刚才的结果再乘以 2")],
    },
    config,
  );
  console.log(next.messages.at(-1)?.content);

  // const stream = await graph.stream(
  //   {
  //     messages: [new HumanMessage("请使用乘法工具计算 12*4")],
  //   },
  //   {
  //     configurable: { thread_id: "conv-002" },
  //     streamMode: "updates",
  //   },
  // );
  // for await (const chunk of stream) {
  //   console.log(chunk);
  // }
}

main().catch(console.error);
