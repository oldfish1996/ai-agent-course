import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiModule } from './ai.module.js';

describe('get_local_time', () => {
  afterEach(() => vi.useRealTimers());

  it('以北京时间返回调用时刻，跨年后再次调用不会复用旧时间', async () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AiModule);
    const provider = providers.find(
      (entry: { provide?: string }) => entry.provide === 'GET_LOCAL_TIME',
    );
    const timeTool: StructuredToolInterface = provider.useFactory();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T15:59:59Z'));
    expect(JSON.parse(await timeTool.invoke({}))).toEqual({
      timeZone: 'Asia/Shanghai',
      currentTime: '2026-12-31 23:59:59',
    });
    vi.setSystemTime(new Date('2026-12-31T16:00:01Z'));
    expect(JSON.parse(await timeTool.invoke({}))).toEqual({
      timeZone: 'Asia/Shanghai',
      currentTime: '2027-01-01 00:00:01',
    });
  });
});
