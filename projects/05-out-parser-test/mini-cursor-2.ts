import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { parsePartialJson } from "@langchain/core/output_parsers";
import chalk from "chalk";

import {
  executeCommandTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
} from "../01-tool-test/src/all-tools.ts";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  temperature: 0,
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

// 各工具的 Zod schema 不同，直接从 tools 数组中取值会形成无法调用的联合类型。
// Agent 在运行时只需要统一的 name + invoke 接口，所以在注册表边界收窄类型。
type AgentTool = {
  name: string;
  invoke(input: unknown): Promise<unknown>;
};

const toolRegistry = new Map<string, AgentTool>(
  tools.map((tool) => [tool.name, tool as unknown as AgentTool]),
);

// 并行生成多个文件会让不同文件的代码片段交错在终端中。
// 这个教学示例一次只允许一个工具调用，以保证流式输出容易阅读。
const modelWithTools = model.bindTools(tools, {
  parallel_tool_calls: false,
});

type WriteStreamState = {
  toolName: string;
  rawArgs: string;
  printedContent: string;
  announced: boolean;
};

/**
 * 将消息内容转换成适合终端显示的文本。
 * 大多数模型返回 string；这里同时兼容包含 text block 的消息格式。
 */
function contentToString(content: AIMessageChunk["content"]): string {
  if (typeof content === "string") return content;

  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if ("text" in block && typeof block.text === "string") return block.text;
      return "";
    })
    .join("");
}

/**
 * 实时展示 write_file 的 content 参数。
 *
 * tool_call_chunks 中的 args 是 JSON 字符串片段，不能直接打印，否则会看到
 * `\\n`、`\\"` 等 JSON 转义字符。这里累计每个工具调用的参数，并使用
 * parsePartialJson 解码当前已经生成的部分，然后只打印新增的代码。
 */
function printStreamingFileContent(
  chunk: AIMessageChunk,
  states: Map<number, WriteStreamState>,
): void {
  for (const toolChunk of chunk.tool_call_chunks ?? []) {
    const index = toolChunk.index ?? 0;
    const state = states.get(index) ?? {
      toolName: "",
      rawArgs: "",
      printedContent: "",
      announced: false,
    };

    state.toolName += toolChunk.name ?? "";
    state.rawArgs += toolChunk.args ?? "";
    states.set(index, state);

    if (state.toolName !== "write_file") continue;

    // parsePartialJson允许解析尚未完成的 JSON。
    const args = parsePartialJson(state.rawArgs) as
      | { filePath?: unknown; content?: unknown }
      | null;

    if (!args || typeof args.content !== "string") continue;

    if (!state.announced) {
      const filePath =
        typeof args.filePath === "string" ? args.filePath : "未知文件";
      process.stdout.write(
        chalk.blue(`\n[生成文件] ${filePath}\n${"─".repeat(60)}\n`),
      );
      state.announced = true;
    }

    // 正常的流式参数只会在末尾追加内容。若服务端改写了已生成的前缀，
    // 终端无法可靠撤回旧文本，因此暂不打印，最终仍以完整工具调用为准。
    if (args.content.startsWith(state.printedContent)) {
      process.stdout.write(args.content.slice(state.printedContent.length));
      state.printedContent = args.content;
    }
  }
}

/**
 * 调用模型一次，并把所有 chunk 合并成可加入历史记录的完整 AI 消息。
 * 文本回复与 write_file 参数都会边生成边显示，但工具只在消息完整后执行。
 */
async function streamModelResponse(
  messages: Awaited<ReturnType<InMemoryChatMessageHistory["getMessages"]>>,
): Promise<AIMessageChunk> {
  const stream = await modelWithTools.stream(messages);
  const writeStates = new Map<number, WriteStreamState>();
  let fullMessage: AIMessageChunk | undefined;

  for await (const chunk of stream) {
    fullMessage = fullMessage ? fullMessage.concat(chunk) : chunk;

    const text = contentToString(chunk.content);
    if (text) process.stdout.write(text);

    printStreamingFileContent(chunk, writeStates);
  }

  if (!fullMessage) {
    throw new Error("模型没有返回任何内容");
  }

  process.stdout.write("\n");
  return fullMessage;
}

/**
 * 执行一条完整 AI 消息里的工具调用，并为每次调用生成对应的 ToolMessage。
 * 即使工具不存在或执行失败，也必须回传 ToolMessage，才能保持消息协议完整。
 */
async function executeToolCalls(message: AIMessageChunk): Promise<ToolMessage[]> {
  const results: ToolMessage[] = [];

  for (const toolCall of message.tool_calls ?? []) {
    const toolCallId = toolCall.id;
    if (!toolCallId) {
      throw new Error(`工具调用 ${toolCall.name} 缺少 id`);
    }

    const selectedTool = toolRegistry.get(toolCall.name);
    let result: unknown;

    try {
      result = selectedTool
        ? await selectedTool.invoke(toolCall.args)
        : `工具不存在: ${toolCall.name}`;
    } catch (error) {
      result = `工具执行失败: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }

    results.push(
      new ToolMessage({
        tool_call_id: toolCallId,
        content: typeof result === "string" ? result : JSON.stringify(result),
      }),
    );
  }

  return results;
}

async function runAgentWithTools(
  query: string,
  maxIterations = 30,
): Promise<AIMessageChunk["content"]> {
  const history = new InMemoryChatMessageHistory();

  await history.addMessages([
    new SystemMessage(`
你是一个智能代码助手。请使用工具完成用户交给你的开发任务。
当前工作目录：${process.cwd()}

可用工具：
- read_file：读取文件
- write_file：写入文件
- execute_command：执行命令，可通过 workingDirectory 指定工作目录
- list_directory：列出目录

规则：
1. 使用 execute_command 的 workingDirectory 后，不要再在 command 中执行 cd。
2. 修改代码前先读取相关文件，完成后使用合适的命令检查结果。
3. write_file 必须提供完整文件内容，不要省略未修改的代码。
4. 写 React 组件时，如果存在配套 CSS 文件，记得在组件中导入。
`),
    new HumanMessage(query),
  ]);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(chalk.bgGreen.black(` 第 ${iteration} 轮 `));

    const message = await streamModelResponse(await history.getMessages());
    await history.addMessage(message);

    if (!message.tool_calls?.length) {
      return message.content;
    }

    const toolMessages = await executeToolCalls(message);
    await history.addMessages(toolMessages);
  }

  throw new Error(`达到最大迭代次数 ${maxIterations}，任务仍未完成`);
}

const task = `创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\\nn" | pnpm create vite react-todo-app --template react-ts
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

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果。
去掉 main.tsx 里的 index.css 导入。

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖
2. 使用 pnpm run dev 启动服务器
`;

try {
  await runAgentWithTools(task);
} catch (error) {
  console.error(chalk.red("运行失败："), error);
  process.exitCode = 1;
}
