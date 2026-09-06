// FewShotPromptTemplate：加入示例

import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";

const examplePrompt = PromptTemplate.fromTemplate(`用户输入：{input}
意图分类：{output}`);

const prompt = new FewShotPromptTemplate({
  examples: [
    {
      input: "这个月扣了我两次钱",
      output: "重复扣款",
    },
    {
      input: "我想把专业版取消掉",
      output: "取消订阅",
    },
    {
      input: "为什么一直登录不上去",
      output: "登录故障",
    },
  ],
  examplePrompt,
  prefix: "请根据示例分类用户输入的意图：",
  suffix: `用户输入：{query} 意图分类：`,
  inputVariables: ["query"],
  exampleSeparator: "\n\n",
});

const formatted = await prompt.format({ query: "会员不想继续用了" });
console.log(formatted);
