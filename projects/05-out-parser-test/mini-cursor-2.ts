import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import chalk from "chalk";
// import { z } from "zod";
import {
  JsonOutputToolsParser,
  type ParsedToolCall,
} from "@langchain/core/output_parsers/openai_tools";

import {
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
} from "../01-tool-test/src/all-tools.ts";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const tools = [
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
];

const modelWithTools = model.bindTools(tools);

function contentToString(content: AIMessageChunk["content"]) {
  return typeof content === "string" ? content : JSON.stringify(content);
}

async function runAgentWIthTools(query: string, maxIterations: number = 30) {
  const history = new InMemoryChatMessageHistory();

  await history.addMessages([
    new SystemMessage(`
      你是一个项目管理助手，使用工具完成任务。
      当前工作目录是：${process.cwd()}
      工具：
      1.read_file: 读取文件
      2.write_file: 写入文件
      3.execute_command: 执行命令（支持 workingDirectory 参数）
      4.list_directory: 列出目录

      重要规则 - execute_command：
      - workingDirectory 参数会自动切换到指定目录
      - 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
      - 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
      这是错误的！因为 workingDirectory 已经在 react-todo-app 目录了，再 cd react-todo-app 会找不到目录
      - 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
      这样就对了！workingDirectory 已经切换到 react-todo-app，直接执行命令即可

      重要规则 - write_file：
      - 当写入 React 组件文件（如 App.tsx）时，如果存在对应的 CSS 文件（如 App.css），在其他 import 语句后加上这个 css 的导入
      `),
  ]);

  await history.addMessages([new HumanMessage(query)]);

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...\n`));

    const messages = await history.getMessages();

    const rawStream = await modelWithTools.stream(messages);

    // 拼接完整的 AIMessage
    let fullAIMessage: AIMessageChunk | null = null;

    const toolParser = new JsonOutputToolsParser<ParsedToolCall[]>({
      returnId: true,
    });

    // 记录每个工具调用已打印的长度（用id或filePath作为key）
    const printedLengths = new Map<string, number>();

    console.log(chalk.blue("\n 🚀 Agent 开始思考并生成流...\n"));

    for await (const chunk of rawStream) {
      fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

      let parsedTools: ParsedToolCall[] = [];
      try {
        parsedTools = await toolParser.parseResult([
          {
            message: fullAIMessage,
            text: contentToString(fullAIMessage.content),
          },
        ]);
      } catch (_e) {
        // 解析失败说明 JSON还不完整，忽略错误继续累计
      }

      if (parsedTools && parsedTools.length > 0) {
        for (const toolCall of parsedTools) {
          if (toolCall.type === "write_file" && toolCall.args?.content) {
            const toolCallId =
              toolCall.id || toolCall.args.filePath || "default";
            const currentContent = String(toolCall.args.content);
            const previousContent = printedLengths.get(toolCallId);
            const previousLength = previousContent ?? 0;

            if (previousContent === undefined) {
              printedLengths.set(toolCallId, 0);
              console.log(
                chalk.blue(
                  `[工具调用] write_file("${toolCall.args.filePath}") - 开始写入`,
                ),
              );
            }

            if (currentContent.length > previousLength) {
              const newContent = currentContent.slice(previousLength);
              process.stdout.write(newContent);
              printedLengths.set(toolCallId, currentContent.length);
            }
          }
        }
      } else {
        // 当前还没有解析到工具调用，如果有文本调用直接输出
        if (chunk.content) {
          process.stdout.write(
            typeof chunk.content === "string"
              ? chunk.content
              : JSON.stringify(chunk.content),
          );
        }
      }

    }

    if (!fullAIMessage) {
      continue;
    }

    // 此时 fullAIMessage 已经还原，直接存入 history
    await history.addMessages([fullAIMessage]);
    console.log("✅ 消息已添加到历史记录");

    if (!fullAIMessage.tool_calls || fullAIMessage.tool_calls.length === 0) {
      console.log(`✨ AI 最终回复： ${contentToString(fullAIMessage.content)}\n`);
      return fullAIMessage.content;
    }

    // 处理工具调用
    for (const toolCall of fullAIMessage.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (!foundTool) {
        continue;
      }

      if (!toolCall.id) {
        console.warn(`工具调用 ${toolCall.name} 缺少 id，已跳过`);
        continue;
      }

      const toolResult = await (foundTool.invoke as any)(toolCall.args);
      await history.addMessages([
        new ToolMessage({
          content: toolResult,
          tool_call_id: toolCall.id,
        }),
      ]);
    }
  }
  const finalMessage = await history.getMessages();
  return finalMessage[finalMessage.length - 1].content;
}

const case1 = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts
2. 修改 src/App.tsx，实现完整功能的 TodoList：
  - 添加、删除、编辑、标记完成
  - 分类筛选（全部/进行中/已完成）
  - 统计信息显示
  - localStorage 数据持久化
3. 添加复杂样式：
  - 渐变背景（蓝到紫）
  - 卡片阴影、圆角
  - 悬停效果
4. 添加动画：
  - 添加/删除时的过渡动画
  - 使用 CSS transitions
5. 列出目录确认

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果

去掉 main.tsx 里的 index.css 导入

之后在 react-todo-app 项目中：
  1. 使用 pnpm install 安装依赖
  2. 使用 pnpm run dev 启动服务器
`;

try {
  await runAgentWIthTools(case1);
} catch (error) {
  console.error("错误:", error);
}
