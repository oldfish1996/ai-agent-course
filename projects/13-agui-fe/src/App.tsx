import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

type MessagePart = UIMessage["parts"][number];
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const suggestions = [
  "搜索一下北京今天的天气",
  "最近有哪些值得关注的 AI 新闻？",
  "介绍一下 AI Agent 的工作流程",
];

function formatValue(value: unknown) {
  if (value === undefined) return "等待参数…";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function PartView({ part, active }: { part: MessagePart; active: boolean }) {
  if (part.type === "text") {
    // Markdown 默认不解析原始 HTML，模型输出不能作为页面脚本执行。
    return (
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }
  if (part.type === "reasoning") {
    return (
      <details className="process reasoning" open>
        <summary>
          模型思考{" "}
          <span className="badge">
            {part.state === "streaming"
              ? active
                ? "思考中"
                : "已结束"
              : "已完成"}
          </span>
        </summary>
        <div className="reasoning-content">{part.text || "等待思考内容…"}</div>
      </details>
    );
  }
  // LangChain 适配器发送 dynamic-tool；同时兼容 SDK 的 tool-工具名格式。
  // input/output 都由后端执行并回传，前端只展示，不能重复调用工具。
  if (isToolUIPart(part)) {
    const name = getToolName(part);
    const pending =
      part.state === "input-streaming" || part.state === "input-available";
    // 当前 web_search 用普通字符串返回业务失败，不能仅凭 output-available 判断成功。
    const businessError =
      name === "web_search" &&
      typeof part.output === "string" &&
      part.output.trim().startsWith("搜索失败:");
    const failed = part.state === "output-error" || businessError;
    const labels: Record<typeof part.state, string> = {
      "input-streaming": "正在生成参数",
      "input-available": "执行中",
      "output-available": "已完成",
      "output-error": "执行失败",
      "output-denied": "已拒绝",
      "approval-requested": "等待授权",
      "approval-responded": "已回应授权",
    };
    const label = failed
      ? "执行失败"
      : pending && !active
        ? "已中断"
        : labels[part.state];
    return (
      <details className={`process tool ${failed ? "failed" : ""}`} open>
        <summary>
          <span>
            {name === "web_search" ? "联网搜索" : "工具调用"} ·{" "}
            <code>{name}</code>
          </span>
          <span className="badge">{label}</span>
        </summary>
        <div className="tool-body">
          <div className="field-label">调用参数</div>
          <pre>{formatValue(part.input)}</pre>
          {part.state === "output-available" && (
            <>
              <div className="field-label">工具结果</div>
              <pre>{formatValue(part.output)}</pre>
            </>
          )}
          {part.state === "output-error" && (
            <p role="alert">{part.errorText}</p>
          )}
          {part.state === "output-denied" && <p>工具执行未获授权。</p>}
        </div>
      </details>
    );
  }
  if (part.type === "source-url" && /^https?:\/\//i.test(part.url)) {
    return (
      <a className="source" href={part.url} target="_blank" rel="noreferrer">
        来源：{part.title || part.url}
      </a>
    );
  }
  // step-start 只是协议分隔标记，不是模型正文；不打乱 parts 的原始顺序。
  return null;
}

export default function App() {
  const chatUrl = `${API_BASE}/ai/chat`;
  // 使用 SDK 解析 SSE 和合并增量消息，发送时自动带上完整 UIMessage 历史。
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: chatUrl,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            // 停止或断网可能留下无结果的 tool-call。仅在发送历史时移除它们，
            // 避免后端转为模型消息后出现未配对的调用；页面仍保留中断现场。
            messages: messages
              .map((message) => ({
                ...message,
                parts: message.parts.filter(
                  (part) =>
                    !isToolUIPart(part) ||
                    part.state === "output-available" ||
                    part.state === "output-error" ||
                    part.state === "output-denied",
                ),
              }))
              .filter((message) =>
                message.parts.some((part) => part.type !== "step-start"),
              ),
          },
        }),
      }),
    [chatUrl],
  );
  const {
    messages,
    sendMessage,
    regenerate,
    status,
    stop,
    error,
    clearError,
    setMessages,
  } = useChat<UIMessage>({ transport });
  const [input, setInput] = useState("");
  const [stopped, setStopped] = useState(false);
  const [localError, setLocalError] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const listRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const submitting = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // 用户上翻阅读历史时不抢滚动位置；回到底部后继续跟随流式输出。
    if (followBottom.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  async function submit(text = input) {
    const trimmed = text.trim();
    if (!trimmed || busy || submitting.current) return;
    submitting.current = true;
    clearError();
    setLocalError("");
    setStopped(false);
    setInput("");
    followBottom.current = true;
    try {
      await sendMessage({ text: trimmed });
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "发送失败，请重试",
      );
    } finally {
      submitting.current = false;
    }
  }

  async function retry() {
    if (busy || submitting.current) return;
    submitting.current = true;
    clearError();
    setLocalError("");
    setStopped(false);
    followBottom.current = true;
    // regenerate 替换最后一次助手回答，避免把失败的问题再追加一遍。
    try {
      await regenerate();
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "重试失败");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="eyebrow">AGENT WORKSPACE</div>
          <h1>AGUI 对话助手</h1>
          <p>提问、观察思考与工具调用，一起找到答案。</p>
        </div>
        <button
          className="secondary"
          disabled={busy || messages.length === 0}
          onClick={() => {
            setMessages([]);
            clearError();
            setLocalError("");
            setStopped(false);
            setInput("");
            inputRef.current?.focus();
          }}
        >
          新对话
        </button>
      </header>
      <div className="connection">
        <span className="dot" />
        支持联网搜索 <span className="endpoint">{chatUrl}</span>
      </div>
      <main
        className="messages"
        ref={listRef}
        onScroll={() => {
          const list = listRef.current;
          if (list)
            followBottom.current =
              list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        }}
        aria-label="对话记录"
        aria-busy={busy}
      >
        {messages.length === 0 && (
          <section className="empty">
            <div className="empty-icon">✳</div>
            <h2>今天想了解什么？</h2>
            <p>直接提问，或试试下面的话题。助手会按需调用联网搜索。</p>
            <div className="suggestions">
              {suggestions.map((text) => (
                <button
                  key={text}
                  disabled={busy}
                  onClick={() => void submit(text)}
                >
                  {text}
                  <span>↗</span>
                </button>
              ))}
            </div>
            <p className="hint">
              思考内容仅在模型和后端返回 reasoning 时展示。
            </p>
          </section>
        )}
        {messages.map((message, index) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="message-label">
              {message.role === "user" ? "你" : "AGUI 助手"}
            </div>
            <div className="message-content">
              {message.parts.map((part, partIndex) => (
                <PartView
                  key={
                    isToolUIPart(part)
                      ? part.toolCallId
                      : `${message.id}-${partIndex}`
                  }
                  part={part}
                  active={busy && index === messages.length - 1}
                />
              ))}
            </div>
          </article>
        ))}
        {busy && (
          <p className="activity" role="status">
            <span className="dot pulse" />
            {status === "submitted" ? "正在等待助手响应…" : "助手正在处理…"}
          </p>
        )}
        {stopped && !busy && (
          <p className="hint" role="status">
            已停止生成，已接收的内容已保留。
          </p>
        )}
      </main>
      <footer className="composer-area">
        {(error || localError) && (
          <div className="error" role="alert">
            <div>
              <strong>本次请求失败</strong>
              <p>{error?.message || localError}</p>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void retry()}
            >
              重试
            </button>
          </div>
        )}
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="sr-only" htmlFor="question">
            输入你的问题
          </label>
          <textarea
            id="question"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入你的问题…"
            rows={3}
            onKeyDown={(event) => {
              // 中文输入法确认候选词时不能触发提交；Shift + Enter 保留换行。
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className="composer-bottom">
            <span>Enter 发送 · Shift + Enter 换行</span>
            {busy ? (
              <button
                type="button"
                className="stop"
                onClick={() => {
                  void stop();
                  setStopped(true);
                }}
              >
                停止生成
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}>
                发送 ↑
              </button>
            )}
          </div>
        </form>
        <p className="footer-note">回答由 AI 生成，请核实重要信息。</p>
      </footer>
    </div>
  );
}
