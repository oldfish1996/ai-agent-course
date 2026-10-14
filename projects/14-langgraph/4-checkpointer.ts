import {
  Annotation,
  END,
  START,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  visitCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  message: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
});

function record(state) {
  const visitCount = state.visitCount + 1;
  const message = `这是你第${visitCount}次访问`;
  return { visitCount, message };
}

const graph = new StateGraph(StateAnnotation)
  .addNode("record", record)
  .addEdge(START, "record")
  .addEdge("record", END);

const checkpointer = new MemorySaver();
const app = graph.compile({ checkpointer });

// thread_id 用于区分不同的用户访问
const user1 = { configurable: { thread_id: "user1" } };
const user2 = { configurable: { thread_id: "user2" } };

const res1 = await app.invoke({}, user1);
const res2 = await app.invoke({}, user1);
const res3 = await app.invoke({}, user1);
const res4 = await app.invoke({}, user2);

console.log(res1);
console.log(res2);
console.log(res3);
console.log(res4);
