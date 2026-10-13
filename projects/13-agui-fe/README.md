# AGUI 对话前端

与 `../12-agui-backend` 配套的 React 聊天页面，使用 AI SDK UI Message Stream。

## 启动

1. 配置并启动后端（默认 `http://localhost:3000`）。后端模型与搜索服务的密钥只在服务端配置。
2. 在本目录执行 `npm install`、`npm run dev`。
3. 若后端地址不同，复制 `.env.example` 为 `.env.local`，修改 `VITE_API_BASE_URL`，然后重启 Vite。

`npm run build` 执行类型检查与生产构建；`npm run lint` 执行代码检查。

## 交互与协议

- `POST /ai/chat`：`DefaultChatTransport` 自动发送完整 `messages` 历史，`useChat` 解析 SSE、合并增量输出和管理请求状态。
- 按 `message.parts` 原始顺序展示 Markdown 回答、可折叠 reasoning、工具参数和结果，支持一个回答中多次工具调用。
- 兼容 `dynamic-tool` 与 `tool-*`。工具在后端执行，前端不会再次执行或提交工具结果。
- `web_search` 参数为 `query`、可选 `count`；后端返回文本搜索结果或 `搜索失败:` 字符串。页面同时识别此业务失败和 SDK 的 `output-error`。
- 支持 Enter 发送、Shift + Enter 换行、中文输入法、新对话、停止、失败重试。重试替换最后一次回答，不重复追加问题。
- 思考内容取决于模型及 LangChain 适配器是否输出 reasoning 事件；没有该事件时不会伪造思考过程。
- 停止会中断前端读取并保留已收到内容；不保证取消已经在服务端执行的搜索。会话仅保存在当前页面内存，刷新后清空。

## 浏览器回归测试

首次运行先执行 `npx playwright install chromium`，再执行 `npm run test:e2e`。
测试自动启动 Vite 并模拟 `/ai/chat` 的 SSE 响应，覆盖思考/工具/Markdown 渲染、多轮历史、请求失败重试、搜索业务失败、中文输入法、换行和停止请求，不消耗真实模型额度。
