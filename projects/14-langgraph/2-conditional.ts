import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

type Route = "math" | "chat";

const StateAnnotation = Annotation.Root({
  query: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  route: Annotation<Route>({
    reducer: (_prev, next) => next,
    default: () => "chat",
  }),
  answer: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

type GraphState = typeof StateAnnotation.State;

const router = (state: GraphState): { route: Route } => {
  const isMath = /[+\-*/]/.test(state.query);
  return { route: isMath ? "math" : "chat" };
};

const mathNode = (state: GraphState) => {
  try {
    return { answer: String(eval(state.query)) };
  } catch (err) {
    return { answer: "计算失败" };
  }
};

const chatNode = (state: GraphState) => ({
  answer: `你的query是: ${state.query}`,
});

const graph = new StateGraph(StateAnnotation)
  .addNode("router", router)
  .addNode("math", mathNode)
  .addNode("chat", chatNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", (state) => state.route, {
    math: "math",
    chat: "chat",
  })
  .addEdge("math", END)
  .addEdge("chat", END)
  .compile();

const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid({ withStyles: true });
console.log(mermaid);

console.log("result:", await graph.invoke({ query: "你好" }));
console.log("result:", await graph.invoke({ query: "5*8" }));
