import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Runnable } from '@langchain/core/runnables';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(
    // 这样可以不用耦合service和model，model可以被其他service使用
    @Inject('CHAT_MODEL') model: ChatOpenAI,
  ) {
    const prompt = PromptTemplate.fromTemplate(`请回答以下问题：{query}`);
    // const model = new ChatOpenAI({
    //   temperature: 0.7,
    //   apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
    //   model: this.configService.getOrThrow('MODEL_NAME'),
    //   configuration: {
    //     baseURL: this.configService.getOrThrow('OPENAI_BASE_URL'),
    //   },
    // });
    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async runChain(query: string): Promise<string> {
    return this.chain.invoke({ query });
  }

  async *streamChain(query: string): AsyncIterable<string> {
    const stream = await this.chain.stream({ query });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
