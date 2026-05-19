import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  // temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const mcpServerPath = path.join(currentDir, "my-mcp-server.ts");

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "my-mcp-server": {
      command: "tsx",
      args: [mcpServerPath],
    },
    "amap-maps-streamHTTP": {
      url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_API_KEY}`,
    },
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        ...(process.env.ALLOWED_PATH.split(",") || ""),
      ],
    },
    "chrome-devtools": {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
  },
});

const tools = await mcpClient.getTools();

const modelWithTools = model.bindTools(tools);

let resourceContent = "";
const res = await mcpClient.listResources();
// console.log(res);
for (const [serverName, resources] of Object.entries(res)) {
  for (const resource of resources) {
    const content = await mcpClient.readResource(serverName, resource.uri);
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

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(
      chalk.bgBlue(`[检测到 ${response.tool_calls.length} 个工具调用]`),
    );
    console.log(
      chalk.bgBlue(
        `[执行工具] ${response.tool_calls.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(", ")}`,
      ),
    );

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);

      if (foundTool) {
        const toolResult = await (foundTool.invoke as any)(toolCall.args);

        let contentStr = "";
        if (toolResult?.text) {
          contentStr = toolResult.text;
        } else {
          contentStr = toolResult;
        }
        messages.push(
          new ToolMessage({
            content: contentStr,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }

  return messages[messages.length - 1].content;
}

// await runAgentWithTools("请查询数据库中的用户信息，用户 ID 为 001");
// await runAgentWithTools("MCP Server 的使用指南是什么");
// await runAgentWithTools("查询用户002的个人信息");
await runAgentWithTools(
  "上海漕河泾开发区附近的酒店，打开浏览器，展示每个酒店的图片，每个 tab 一个 url 展示",
);

await mcpClient.close();
