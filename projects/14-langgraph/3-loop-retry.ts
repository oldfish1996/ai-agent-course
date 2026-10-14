import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  tries: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  ok: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  message: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

const attempt = (state) => {
  const tries = state.tries + 1;
  const ok = tries >= 3;
  return {
    tries,
    ok,
    message: ok ? `第${tries}次成功` : `失败，尝试第${tries}次`,
  };
};

const graph = new StateGraph(StateAnnotation)
  .addNode("attempt", attempt)
  .addEdge(START, "attempt")
  .addConditionalEdges("attempt", (state) => (state.ok ? "done" : "retry"), {
    retry: "attempt",
    done: END,
  })
  .compile();

const drawable = await graph.getGraphAsync();
const mermaid = drawable.drawMermaid();
console.log(mermaid);

const result = await graph.invoke({ tries: 0 });
console.log(result);
