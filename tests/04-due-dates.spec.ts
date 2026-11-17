import { test, expect, createTodo, future } from './helpers';
test('optional and future due dates', async ({ page }) => { expect((await createTodo(page)).due_date).toBeNull(); const due_date = future(); expect(Date.parse((await createTodo(page, { due_date })).due_date!)).toBe(Date.parse(due_date)); });
test('past malformed and too-soon dates rejected', async ({ page }) => { for (const due_date of ['2020-01-01T10:00:00+08:00', 'invalid', future(0.2)])
    expect((await page.request.post('/api/todos', { data: { title: 'Invalid', due_date } })).status()).toBe(400); });
test('impossible calendar dates are rejected rather than normalized', async ({ page }) => { expect((await page.request.post('/api/todos', { data: { title: 'Impossible', due_date: '2030-02-30T10:00:00+08:00' } })).status()).toBe(400); });
