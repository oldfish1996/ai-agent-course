import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  text: Annotation({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

const step1 = (state) => ({ text: `${state.text} step1` });
const step2 = (state) => ({ text: `${state.text} step2` });

// addNode(name, fn)
// addEdge(from, to)
// addConditionalEdges(from, router)

const graph = new StateGraph(StateAnnotation)
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", END)
  .compile();

  const drawable = await graph.getGraphAsync();
  const mermaid = drawable.drawMermaid({ withStyles: true });
  console.log('mermaid:', mermaid);

  const result = await graph.invoke({ text: "hello" });
  console.log('result:', result);
