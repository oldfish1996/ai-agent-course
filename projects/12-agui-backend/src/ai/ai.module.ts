import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { AiController } from './ai.controller.js';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import chalk from 'chalk';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: 'CHAT_MODEL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new ChatOpenAI({
          model: configService.get('MODEL_NAME'),
          apiKey: configService.get('OPENAI_API_KEY'),
          configuration: {
            baseURL: configService.get('OPENAI_BASE_URL'),
          },
        }),
    },
    {
      provide: 'GET_LOCAL_TIME',
      // Nest provider 只是依赖注入注册；必须包装为带名称、说明和 schema 的工具，
      // 并在 AiService 的 tools 中注册，模型才能发现和调用它。
      useFactory: () =>
        tool(
          async () =>
            JSON.stringify({
              timeZone: 'Asia/Shanghai',
              // 每次调用时读取时钟，避免把服务启动时间当作当前时间。
              currentTime: new Date().toLocaleString('sv-SE', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
              }),
            }),
          {
            name: 'get_local_time',
            description:
              '获取当前真实日期和时间（北京时间，Asia/Shanghai）。涉及今天、最近、最新、今年等相对时间的问题时，先调用本工具确定时间，再进行搜索。',
            schema: z.object({}),
          },
        ),
    },
    {
      provide: 'WEB_SEARCH_TOOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const webSearchArgsSchema = z.object({
          query: z.string().min(1).describe('搜索关键词'),
          count: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe('搜索结果数量'),
        });
        return tool(
          async ({ query, count }: { query: string; count?: number }) => {
            console.log(chalk.bgCyan(`WEB_SEARCH_TOOL ${query}`));
            const apiKey = configService.get('BOCHAT_API_KEY');
            const url = 'https://api.bochaai.com/v1/web-search';
            const body = {
              query,
              count: count || 3,
              summary: true,
              freshness: 'noLimit',
            };
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
            });
            if (!response.ok) {
              const errText = await response.text();
              return `搜索失败: ${response.status} ${errText}`;
            }
            let json;
            try {
              json = await response.json();
            } catch (err) {
              return `搜索失败: ${(err as Error).message}`;
            }
            try {
              if (json.code !== 200 || !json.data) {
                return `搜索失败: ${json.code} ${json.msg}`;
              }
              const webpages = json.data.webPages?.value || [];
              if (webpages.length === 0) {
                return `搜索失败: 没有搜索结果`;
              }
              const formatted = webpages
                .map(
                  (w: any, i: number) => `引用:${i + 1} 
                标题:${w.name} 
                链接:${w.url}
                摘要:${w.summary}
                网站名称:${w.siteName}
                发布时间:${w.datePublished}`,
                )
                .join('\n');
              return formatted;
            } catch (err) {
              return `搜索失败: ${(err as Error).message}`;
            }
          },
          {
            name: 'web_search',
            description:
              '使用Bocha Web Search API搜索互联网, 返回搜索结果的详细信息',
            schema: webSearchArgsSchema,
          },
        );
      },
    },
  ],
})
export class AiModule {}
