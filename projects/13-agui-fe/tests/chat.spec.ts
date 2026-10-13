import { expect, test } from '@playwright/test'

function stream(output = '引用:1 标题:北京天气 链接:https://example.com') {
  const events = [
    { type: 'start', messageId: crypto.randomUUID() },
    { type: 'start-step' },
    { type: 'reasoning-start', id: 'r1' },
    { type: 'reasoning-delta', id: 'r1', delta: '需要搜索最新天气。' },
    { type: 'reasoning-end', id: 'r1' },
    { type: 'tool-input-start', toolCallId: 't1', toolName: 'web_search', dynamic: true },
    { type: 'tool-input-delta', toolCallId: 't1', inputTextDelta: '{"query":"北京天气"}' },
    { type: 'tool-input-available', toolCallId: 't1', toolName: 'web_search', input: { query: '北京天气' }, dynamic: true },
    { type: 'tool-output-available', toolCallId: 't1', output, dynamic: true },
    { type: 'finish-step' },
    { type: 'start-step' },
    { type: 'text-start', id: 'text1' },
    { type: 'text-delta', id: 'text1', delta: '这是**天气回答**。' },
    { type: 'text-end', id: 'text1' },
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' },
  ]
  return events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n'
}
const headers = { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }

test('展示 reasoning、动态工具与 Markdown，并携带历史进行多轮提问', async ({ page }) => {
  const requests: { messages: { role: string; parts: unknown[] }[] }[] = []
  await page.route('**/ai/chat', route => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ headers, body: stream() })
  })
  await page.goto('/')
  await page.getByRole('textbox').fill('北京天气')
  await page.getByRole('textbox').press('Enter')
  await expect(page.getByText('需要搜索最新天气。')).toBeVisible()
  await expect(page.locator('.tool pre').first()).toContainText('北京天气')
  await expect(page.locator('.tool pre').last()).toContainText('引用:1')
  await expect(page.locator('.markdown strong')).toHaveText('天气回答')
  await expect(page.getByRole('button', { name: '发送 ↑' })).toBeVisible()
  expect(await page.locator('.assistant .message-content > *').evaluateAll(nodes => nodes.map(node => node.className))).toEqual(['process reasoning', 'process tool ', 'markdown'])
  await page.getByRole('textbox').fill('明天呢？')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.assistant')).toHaveCount(2)
  expect(requests[1].messages.map(message => message.role)).toEqual(['user', 'assistant', 'user'])
  await page.getByRole('button', { name: '新对话' }).click()
  await expect(page.locator('.message')).toHaveCount(0)
})

test('失败重试不重复问题，并识别搜索业务失败', async ({ page }) => {
  let attempts = 0
  await page.route('**/ai/chat', route => ++attempts === 1
    ? route.fulfill({ status: 500, body: '服务暂时不可用' })
    : route.fulfill({ headers, body: stream('搜索失败: 没有搜索结果') }))
  await page.goto('/')
  await page.getByRole('textbox').fill('搜索天气')
  await page.getByRole('button', { name: '发送 ↑' }).click()
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用')
  await page.getByRole('button', { name: '重试' }).click()
  await expect(page.locator('.tool .badge')).toHaveText('执行失败')
  await expect(page.locator('.user')).toHaveCount(1)
  await expect(page.locator('.error')).toHaveCount(0)
})

test('中文输入法不误提交、Shift Enter 换行、停止等待中的请求', async ({ page }) => {
  await page.route('**/ai/chat', () => { /* 保持请求未返回，验证停止按钮 */ })
  await page.goto('/')
  const input = page.getByRole('textbox')
  await expect(page.getByRole('button', { name: '发送 ↑' })).toBeDisabled()
  await input.fill('测试')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
  await expect(page.locator('.user')).toHaveCount(0)
  await input.press('Shift+Enter')
  await expect(input).toHaveValue('测试\n')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: '新对话' })).toBeDisabled()
  await page.getByRole('button', { name: '停止生成' }).click()
  await expect(page.getByRole('status')).toContainText('已停止生成')
  await expect(page.getByRole('button', { name: '发送 ↑' })).toBeVisible()
})

test('断流后保留工具现场，下一轮不发送未完成的工具调用', async ({ page }, testInfo) => {
  let attempts = 0
  let nextBody = ''
  await page.route('**/ai/chat', route => {
    if (++attempts === 1) {
      const body = [
        { type: 'start', messageId: 'interrupted' },
        { type: 'tool-input-start', toolCallId: 'unfinished', toolName: 'web_search', dynamic: true },
        { type: 'tool-input-available', toolCallId: 'unfinished', toolName: 'web_search', input: { query: '天气' }, dynamic: true },
        { type: 'error', errorText: '连接中断' },
      ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('')
      return route.fulfill({ headers, body })
    }
    nextBody = route.request().postData() || ''
    return route.fulfill({ headers, body: stream() })
  })
  await page.goto('/')
  await page.getByRole('textbox').fill('天气')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.tool .badge')).toHaveText('已中断')
  await page.getByRole('textbox').fill('重新搜索')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.markdown strong')).toHaveText('天气回答')
  expect(nextBody).not.toContain('unfinished')
  await expect(page.locator('.tool').first()).toContainText('已中断')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '发送 ↑' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })
})
