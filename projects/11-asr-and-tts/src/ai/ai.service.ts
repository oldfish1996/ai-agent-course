import { Inject, Injectable } from '@nestjs/common';
import { type Runnable } from '@langchain/core/runnables';
import { type ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class AiService {
  private readonly chain: Runnable;
  constructor(@Inject('CHAT_MODEL') private readonly model: ChatOpenAI) {
    const prompt = PromptTemplate.fromTemplate('回答以下问题：{query}');
    this.chain = prompt.pipe(this.model).pipe(new StringOutputParser());
  }

  async *streamChain(query: string): AsyncGenerator<string> {
    const stream = await this.chain.stream({ query });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
