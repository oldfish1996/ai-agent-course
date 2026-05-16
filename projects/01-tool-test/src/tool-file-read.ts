import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";

import { readFileTool } from "./all-tools.ts";

dotenv.config();

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const tools = [readFileTool];

const modelWithTool = model.bindTools(tools);

const messages: any[] = [
  new SystemMessage(`
    你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）
  `),
  new HumanMessage("请读取 src/tool-file-read.ts 文件内容并解释代码"),
];

let response = await modelWithTool.invoke(messages);

// console.log(response);

messages.push(response);

while (response.tool_calls && response.tool_calls.length > 0) {
  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);

  // 逐个处理工具调用
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        return `错误: 找不到工具 ${toolCall.name}`;
      }
      console.log(
        `  [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
      );
      try {
        const result = await tool.invoke(toolCall.args as any);
        return result;
      } catch (error) {
        console.error(
          ` [工具调用失败] ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
        );
        console.error(` [错误信息] ${error.message}`);
      }
    }),
  );

  // 将工具结果添加到消息历史
  response.tool_calls.forEach((toolCall, index) => {
    messages.push(
      new ToolMessage({
        content: toolResults[index] as any,
        tool_call_id: toolCall.id,
      }),
    );
  });

  // 再次调用模型，传入工具调用结果
  response = await modelWithTool.invoke(messages);

  console.log("\n[最终回复]");
  console.log(response.content);
}
