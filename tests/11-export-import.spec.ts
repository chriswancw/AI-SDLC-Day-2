import { test, expect, createTodo, createTag, addSubtask, todos } from './helpers';
test('export import remaps IDs preserves relations reuses tags and escapes CSV', async ({ page }) => { const t = await createTodo(page, { title: 'Read, "then" write' }); const tag = await createTag(page); await addSubtask(page, t.id); await page.request.post(`/api/todos/${t.id}/tags`, { data: { tag_id: tag.id } }); const data = await (await page.request.get('/api/todos/export?format=json')).json(); expect(data.version).toBe(1); expect(data.todos[0].id).toBeUndefined(); const r = await page.request.post('/api/todos/import', { data }); expect(r.ok(), await r.text()).toBeTruthy(); const rows = await todos(page); expect(rows).toHaveLength(2); const copy = rows.find(x => x.id !== t.id)!; expect(copy.subtasks?.[0].title).toBe('First step'); expect(copy.tags?.[0].id).toBe(tag.id); expect(copy.subtasks?.[0].id).not.toBe(rows.find(x => x.id === t.id)?.subtasks?.[0].id); expect(await (await page.request.get('/api/todos/export?format=csv')).text()).toContain('"Read, ""then"" write"'); });
test('invalid import atomic', async ({ page }) => { expect((await page.request.post('/api/todos/import', { data: { version: 1, todos: [{ title: 'Valid first' }, { title: '' }] } })).status()).toBe(400); expect(await todos(page)).toHaveLength(0); });
test('import preserves completed state and exported timestamps', async ({ page }) => {
    const due_date = '2025-01-01T09:00:00+08:00';
    const created_at = '2024-12-01T01:00:00.000Z';
    const updated_at = '2024-12-15T02:00:00.000Z';
    const last_notification_sent = '2025-01-01T00:50:00.000Z';
    const data = { version: 1, todos: [{ title: 'Archived', completed: true, due_date, priority: 'low', is_recurring: false, recurrence_pattern: null, reminder_minutes: 15, created_at, updated_at, last_notification_sent, subtasks: [{ title: 'Done step', completed: true, position: 8 }], tags: [] }] };
    const r = await page.request.post('/api/todos/import', { data });
    expect(r.ok(), await r.text()).toBeTruthy();
    const imported = (await todos(page))[0];
    expect(imported.completed).toBe(true);
    expect(imported.created_at).toBe(created_at);
    expect(imported.updated_at).toBe(updated_at);
    expect(imported.last_notification_sent).toBe(last_notification_sent);
    expect(imported.subtasks?.[0].completed).toBe(true);
    expect(imported.subtasks?.[0].position).toBe(8);
});
