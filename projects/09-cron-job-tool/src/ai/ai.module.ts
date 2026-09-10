import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { AiService } from './ai.service.js';
import { UserService } from './user.service.js';
import { AiController } from './ai.controller.js';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { MailerService } from '@nestjs-modules/mailer';
import chalk from 'chalk';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    UserService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) =>
        new ChatOpenAI({
          temperature: 0.7,
          apiKey: configService.get('OPENAI_API_KEY'),
          model: configService.get('MODEL_NAME'),
          configuration: {
            baseURL: configService.get('OPENAI_BASE_URL'),
          },
        }),
      inject: [ConfigService],
    },
    {
      provide: 'USER_MANAGER_TOOL',
      useFactory: (userService: UserService) => {
        const queryUserArgsSchema = z.object({
          userId: z.string().describe('用户ID, 例如: 001'),
        });
        // tool 里调用serveice
        return tool(
          async ({ userId }) => {
            console.log(chalk.bgGreen(`USER_MANAGER_TOOL ${userId}`));
            const user = userService.findOne(userId);
            if (!user) {
              const availableUsers = userService.findAll();
              const availableUserIds = availableUsers.map((u) => u.id);
              return `用户 ${userId} 不存在, 可用用户ID: ${availableUserIds.join(',')}`;
            }
            return `用户 ${userId} 信息： ${JSON.stringify(user)}`;
          },
          {
            name: 'query_user',
            description: '查询用户信息',
            schema: queryUserArgsSchema,
          },
        );
      },
      inject: [UserService],
    },
    {
      provide: 'SEND_MAIL_TOOL',
      inject: [MailerService, ConfigService],
      useFactory: (
        mailerService: MailerService,
        configService: ConfigService,
      ) => {
        const sendMailArgsSchema = z.object({
          to: z.email().describe('收件人邮箱'),
          subject: z.string().describe('邮件主题'),
          text: z.string().describe('邮件内容'),
          html: z.string().describe('邮件HTML内容, 可选'),
        });
        return tool(
          async ({ to, subject, text, html }) => {
            console.log(chalk.bgGreen(`SEND_MAIL_TOOL ${to} ${subject}`));
            const fallbackFrom = configService.get('MAIL_FROM');
            await mailerService.sendMail({
              to,
              subject,
              text,
              html,
              from: fallbackFrom,
            });
            return `邮件已发送到 ${to}`;
          },
          {
            name: 'send_mail',
            description: '发送邮件',
            schema: sendMailArgsSchema,
          },
        );
      },
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
          async ({ query, count }) => {
            console.log(chalk.bgGreen(`WEB_SEARCH_TOOL ${query}`));
            const apiKey = configService.get('BOCHAT_API_KEY');
            const url = 'https://api.bochaai.com/v1/web-search';
            const body = {
              query,
              count: count || 5,
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
