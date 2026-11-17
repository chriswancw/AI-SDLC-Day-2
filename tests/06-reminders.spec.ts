import { test, expect, createTodo, future } from './helpers';
test('reminder window and atomic deduplication', async ({ page }) => { const soon = await createTodo(page, { due_date: future(5), reminder_minutes: 15 }); await createTodo(page, { due_date: future(120), reminder_minutes: 15 }); const first = await (await page.request.get('/api/notifications/check')).json(); expect(first.map((t: {
    id: number;
}) => t.id)).toEqual([soon.id]); expect(await (await page.request.get('/api/notifications/check')).json()).toHaveLength(0); });
test('unsupported reminder rejected', async ({ page }) => { expect((await page.request.post('/api/todos', { data: { title: 'Invalid', due_date: future(), reminder_minutes: 3 } })).status()).toBe(400); });
