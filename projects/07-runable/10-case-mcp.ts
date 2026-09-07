import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  ToolMessage,
  HumanMessage,
  type AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  RunnableBranch,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import chalk from "chalk";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "amap-maps-streamHTTP": {
      url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_API_KEY}`,
    },
    "chrome-devtools": {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
  },
});

try {
  const tools = await mcpClient.getTools();
  const modelWithTools = model.bindTools(tools);

  const Prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个可以调用 MCP 工具的智能助手"],
    new MessagesPlaceholder("messages"),
  ]);

  const llmChain = Prompt.pipe(modelWithTools);

  type AgentStepState = {
    messages: BaseMessage[];
    response: AIMessage;
    done?: boolean;
    final?: AIMessage["content"];
    tools: typeof tools;
  };

  // 1.定义处理调用工具的逻辑
  const toolExcutor = new RunnableLambda({
    func: async (input: { response: AIMessage; tools: typeof tools }) => {
      const { response, tools } = input;
      const toolResults: ToolMessage[] = [];

      for (const toolCall of response.tool_calls ?? []) {
        // 没有 ID 就无法把结果关联回模型调用，这是不可恢复的协议错误。
        if (!toolCall.id) throw new Error(`工具调用缺少 ID：${toolCall.name}`);

        try {
          const foundTool = tools.find((tool) => tool.name === toolCall.name);
          if (!foundTool) throw new Error(`未找到工具：${toolCall.name}`);
          const toolResult = await foundTool.invoke({
            ...toolCall,
            type: "tool_call",
          });
          // MCP 适配器会返回 ToolMessage，保留图片内容块和 artifact。
          toolResults.push(
            ToolMessage.isInstance(toolResult)
              ? toolResult
              : new ToolMessage({
                  content: toolResult,
                  tool_call_id: toolCall.id,
                  name: toolCall.name,
                }),
          );
        } catch (error) {
          // 将可恢复的调用错误交还给模型，让它修正参数或选择其他工具。
          toolResults.push(
            new ToolMessage({
              content: `工具执行失败：${error instanceof Error ? error.message : String(error)}`,
              tool_call_id: toolCall.id,
              name: toolCall.name,
              status: "error",
            }),
          );
        }
      }

      return toolResults;
    },
  });

  // 2.对结果处理
  const agentStepChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      response: llmChain,
    }),
    RunnableBranch.from<AgentStepState, AgentStepState>([
      // 分支1:没有工具调用，认为本轮完成
      [
        (state) =>
          !state.response.tool_calls || state.response.tool_calls.length === 0,
        async (state) => {
          const { messages, response } = state;
          const newMessage = [...messages, response];
          return {
            ...state,
            messages: newMessage,
            done: true,
            final: response.content,
          };
        },
      ],
      // 默认分支：执行工具，并将结果追加到消息中
      RunnableSequence.from([
        new RunnableLambda({
          func: async (state: AgentStepState) => {
            const { messages, response } = state;
            const newMessages = [...messages, response];
            console.log(
              chalk.bgBlue(
                `[🔍 检测到 ${response.tool_calls?.length ?? 0} 个工具调用]`,
              ),
            );
            console.log(
              chalk.blue(
                `[执行工具] ${(response.tool_calls ?? []).map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ")}`,
              ),
            );
            return {
              ...state,
              messages: newMessages,
            };
          },
        }),
        RunnablePassthrough.assign({
          toolMessages: toolExcutor,
        }),
        new RunnableLambda({
          func: async (state: AgentStepState & { toolMessages: ToolMessage[] }) => {
            const { messages, toolMessages } = state;
            const newMessages = [...messages, ...toolMessages];
            return {
              ...state,
              messages: newMessages,
              done: false,
            };
          },
        }),
      ]),
    ]),
  ]);

  async function runAgentWithTools(query: string, maxIterations = 30) {
    // if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    //   throw new Error("maxIterations 必须是正整数");
    // }
    let state: Omit<AgentStepState, "response"> & { response?: AIMessage } = {
      messages: [new HumanMessage(query)],
      done: false,
      tools,
    };
    for (let i = 0; i < maxIterations; i++) {
      state = await agentStepChain.invoke(state);
      if (state.done) {
        return state.final;
      }
    }
    throw new Error(`达到最大迭代次数 ${maxIterations}，任务尚未完成`);
  }

  const result = await runAgentWithTools(
    "上海虹桥火车站附近的三个酒店，拿到酒店图片,打开浏览器,展示每个酒店的图片,每个tab一个url展示,并且在把那个页面标题改为酒店名称",
  );
  console.log("最终回答：", result);
} finally {
  // 获取工具失败、执行失败和正常结束，都释放连接及 MCP 子进程。
  await mcpClient.close();
}
