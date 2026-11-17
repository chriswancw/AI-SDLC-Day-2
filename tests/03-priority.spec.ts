import { test, expect, createTodo, todos } from './helpers';
test('priorities validate and default medium', async ({ page }) => { expect((await createTodo(page)).priority).toBe('medium'); for (const priority of ['high', 'medium', 'low'])
    expect((await createTodo(page, { priority })).priority).toBe(priority); expect((await page.request.post('/api/todos', { data: { title: 'Invalid', priority: 'urgent' } })).status()).toBe(400); expect(await todos(page)).toHaveLength(4); });
