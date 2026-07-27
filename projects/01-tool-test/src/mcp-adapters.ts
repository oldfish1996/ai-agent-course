import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import { HumanMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  // temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "tsx",
      args: [
        "/Users/bytedance/Desktop/personal/ai-agent-course/projects/01-tool-test/src/my-mcp-server.ts",
      ],
    },
  },
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

let resourceContent = "";
const res = await mcpClient.listResources();
// console.log(res);
for (const [serverName, resources] of Object.entries(res)) {
  for (const r of resources) {
    const content = await mcpClient.readResource(serverName, r.uri);
    console.log(content);
    resourceContent += content[0].text;
  }
}

async function runAgentWithTools(query: string, maxIterations = 30) {
  const messages: any = [
    new SystemMessage(resourceContent),
    new HumanMessage(query),
  ];
  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // 检查工具调用
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    // 执行工具调用
    console.log(
      chalk.bgBlue(`[检测到 ${response.tool_calls.length} 个工具调用]`),
    );
    console.log(
      chalk.bgBlue(
        `执行工具: ${response.tool_calls.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ")}`,
      ),
    );

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await (foundTool.invoke as any)(toolCall.args);
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }
  return messages[messages.length - 1].content;
}

// await runAgentWithTools("查询用户 ID 为 001 的用户信息");
await runAgentWithTools("my-mcp-server的使用指南是什么");

await mcpClient.close();
