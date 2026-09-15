import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({
  port: 8001,
});

wss.on("connection", (ws) => {
  console.log("客户端连接成功");

  ws.send(
    JSON.stringify({
      type: "system",
      content: "欢迎进入聊天室",
    }),
  );

  ws.on("message", (data) => {
    const message = data.toString();
    console.log("收到消息:", message);

    // 广播消息给所有客户端
    for (const client of wss.clients) {
      client.send(message);
    }
  });

  ws.on("close", () => {
    console.log("客户端连接关闭");
  });

  ws.on("error", (err) => {
    console.error("连接错误:", err);
  });
});

console.log("WebSocket 服务器已启动 ws://localhost:8001");
