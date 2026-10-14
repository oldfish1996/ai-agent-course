import { MemorySaver } from "@langchain/langgraph";
import { createSupervisor } from "@langchain/langgraph-supervisor";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, HumanMessage, tool } from "langchain";
import z from "zod";
import "dotenv/config";

// 在项目根目录配置 .env 中的 MODEL_NAME、OPENAI_API_KEY、OPENAI_BASE_URL。
// 流程：用户 -> supervisor -> 商品 Agent -> supervisor -> 数学 Agent -> supervisor。
// 路由由模型决定，createSupervisor 自动创建 Agent 之间的交接工具和边。

// 1. 商品工具使用本地模拟数据，无需额外的搜索服务或数据库。
const getProductPrice = tool(
  async ({ product }) => {
    const prices = { 键盘: 199, 鼠标: 89 };
    console.log(`\n[工具 get_product_price] ${product}：${prices[product]} 元`);
    return JSON.stringify({ product, price: prices[product], currency: "CNY" });
  },
  {
    name: "get_product_price",
    description: "查询商品单价，单位为人民币元，目前支持键盘和鼠标。",
    schema: z.object({
      product: z.enum(["键盘", "鼠标"]).describe("商品名称"),
    }),
  },
);

const multiply = tool(
  async ({ a, b }) => {
    console.log(`\n[工具 multiply] ${a} * ${b} = ${a * b}`);
    return String(a * b);
  },
  {
    name: "multiply",
    description: "计算两个数字的乘积，可用于计算商品总价。",
    schema: z.object({ a: z.number(), b: z.number() }),
  },
);

async function main() {
  const model = new ChatOpenAI({
    model: process.env.MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
    temperature: 0,
  });

  // 2. 每个 Agent 必须有唯一名称，主管通过名称选择任务接收者。
  const productAgent = createAgent({
    name: "product_agent",
    model,
    tools: [getProductPrice],
    systemPrompt:
      "你是商品查询助手。必须使用 get_product_price 查询单价，不能编造价格。" +
      "只返回商品名称、单价和币种，不计算总价，完成查询后结束回复。",
  });

  const mathAgent = createAgent({
    name: "math_agent",
    model,
    tools: [multiply],
    systemPrompt:
      "你是数学助手。根据上下文中的商品单价和用户指定数量，必须调用 multiply 计算总价。" +
      "返回计算式和结果，完成计算后结束回复。",
  });

  // 3. createAgent 返回的对象通过 .graph 交给 supervisor。
  // supervisor 使用 llm / prompt，createAgent 使用 model / systemPrompt。
  const workflow = createSupervisor({
    agents: [productAgent.graph, mathAgent.graph],
    llm: model,
    prompt:
      "你是团队主管，负责拆分任务、依次委派给专家，并用中文汇总答案。" +
      "product_agent 负责查询商品单价；math_agent 负责乘法计算。" +
      "购买商品的任务先查询单价，再把单价和数量交给数学助手。" +
      "每次只委派给一个专家。已有单价可以复用，但计算必须委派给数学助手。" +
      "专家完成任务后不要重复委派；拿到结果后直接回答用户。",
    // full_history 保留专家的工具调用和回复，便于学习和排查。
    // 改为 last_message 则只保留专家的最终回复（以及交接消息）。
    outputMode: "full_history",
  });

  // 记忆放在父图上；相同 thread_id 的后续调用可以引用上一轮结果。
  const app = workflow.compile({ checkpointer: new MemorySaver() });
  console.log("\n=== Supervisor 图结构 ===");
  console.log((await app.getGraphAsync()).drawMermaid());

  const config = {
    configurable: { thread_id: "supervisor-demo-001" },
    recursionLimit: 50,
  };

  // updates 输出节点完成后的状态增量；values 输出每一步的完整状态。
  // 多模式 + subgraphs: true 返回 [namespace, mode, data]，包含主管和专家子图。
  async function streamAnswer(question: string) {
    const stream = await app.stream(
      { messages: [new HumanMessage(question)] },
      { ...config, streamMode: ["updates", "values"], subgraphs: true },
    );

    for await (const [namespace, mode, data] of stream) {
      const graphPath = namespace.map((part) => part.split(":")[0]).join(" / ") || "主图";
      if (mode === "updates") {
        for (const [nodeName, update] of Object.entries(data)) {
          // 中断是特殊事件，不能当作普通节点完成。
          if (nodeName === "__interrupt__") {
            console.log(`\n[图中断] ${graphPath}`, update);
          } else {
            console.log(`\n[节点完成] ${graphPath} / ${nodeName}`);
            // console.dir(update, { depth: 3 });
          }
        }
      } else if (mode === "values") {
        // data 是当前图的完整状态，不再是按节点名称组织的增量。
        console.log(`\n[完整状态] ${graphPath}`);
        // console.dir(data, { depth: 3 });
      }
    }
    // 必须消费完整个流，再开始同一会话的下一轮，让状态和 checkpoint 完成写入。
  }

  console.log("\n=== 第一轮：查询单价，再计算总价 ===");
  await streamAnswer(
    "请查询键盘的单价，并计算买 3 个键盘多少钱。原价购买，不考虑优惠和运费。",
  );
  // 模拟数据：199 * 3 = 597 元。

  console.log("\n=== 第二轮：复用会话中的商品单价 ===");
  await streamAnswer("如果改成买 5 个同款键盘呢？");
  // 模拟数据：199 * 5 = 995 元。
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
