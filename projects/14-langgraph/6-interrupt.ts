import {
  Annotation,
  StateGraph,
  MemorySaver,
  interrupt,
  Command,
  START,
  END,
} from "@langchain/langgraph";

const ReviewState = Annotation.Root({
  draft: Annotation<string>(),
  approved: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
});

const reviewGraph = new StateGraph(ReviewState)
  .addNode("review", (state) => {
    const approved = interrupt({
      question: "是否审批该草稿？",
      draft: state.draft,
    });
    return { approved: approved === true };
  })
  .addEdge(START, "review")
  .addEdge("review", END)
  .compile({ checkpointer: new MemorySaver() });

async function main() {
  const config = {
    configurable: { thread_id: "review-001" },
  };

  // 首次执行，运行到interrupt暂停
  const paused = await reviewGraph.invoke({ draft: "待审核的内容" }, config);
  console.log(paused);

  // 实际项目中，这一步通常由后续审批请求触发
  const result = await reviewGraph.invoke(
    new Command({ resume: true }),
    config,
  );
  console.log(result.approved);
}

main().catch(console.error);