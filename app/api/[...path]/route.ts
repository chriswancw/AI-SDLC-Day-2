import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db, { listTodos, type Template, type Subtask, type Tag } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getSingaporeNow, parseSingaporeDate, calculateNextDueDate, singaporeInput } from '@/lib/timezone';
export const runtime = 'nodejs';
const title = z.string().trim().min(1).max(500);
const fields = z.object({ title, completed: z.boolean().default(false), due_date: z.string().nullable().default(null), priority: z.enum(['high', 'medium', 'low']).default('medium'), is_recurring: z.boolean().default(false), recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().default(null), reminder_minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440), z.literal(2880), z.literal(10080)]).nullable().default(null) });
const tagSchema = z.object({ name: title, color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#3B82F6') });
const subSchema = z.object({ title, completed: z.boolean().default(false), position: z.number().int().nonnegative().default(0) });
const templateSchema = z.object({ name: title, description: z.string().nullable().default(null), category: z.string().nullable().default(null), title_template: title, priority: z.enum(['high', 'medium', 'low']).default('medium'), is_recurring: z.boolean().default(false), recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().default(null), reminder_minutes: fields.shape.reminder_minutes, due_date_offset_minutes: z.number().int().nonnegative().nullable().default(null), subtasks_json: z.string().nullable().default(null) });
function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
function validateTodo(t: z.infer<typeof fields>, future = true) {
    if (t.due_date) {
        const time = parseSingaporeDate(t.due_date).getTime();
        if (!Number.isFinite(time))
            fail('Invalid due date');
        if (future && time < getSingaporeNow().getTime() + 60000)
            fail('Due date must be at least one minute in the future');
        t.due_date = parseSingaporeDate(t.due_date).toISOString();
    }
    if (t.is_recurring && (!t.due_date || !t.recurrence_pattern))
        fail('Recurring todos require a due date and recurrence pattern');
    if (t.reminder_minutes && !t.due_date)
        fail('Reminders require a due date');
    return t;
}
function insertTodo(u: number, input: unknown, future = true) { const t = validateTodo(fields.parse(input), future); return Number(db.prepare('INSERT INTO todos(user_id,title,completed,due_date,priority,is_recurring,recurrence_pattern,reminder_minutes) VALUES(?,?,?,?,?,?,?,?)').run(u, t.title, +t.completed, t.due_date, t.priority, +t.is_recurring, t.recurrence_pattern, t.reminder_minutes).lastInsertRowid); }
function ownedTodo(u: number, id: number) {
    const t = listTodos(u).find(t => t.id === id);
    if (!t)
        fail('Todo not found', 404);
    return t;
}
function ownTag(u: number, id: number) {
    const t = db.prepare('SELECT * FROM tags WHERE id=? AND user_id=?').get(id, u) as Tag | undefined;
    if (!t)
        fail('Tag not found', 404);
    return t;
}
function ownTemplate(u: number, id: number) {
    const t = db.prepare('SELECT * FROM templates WHERE id=? AND user_id=?').get(id, u) as Template | undefined;
    if (!t)
        fail('Template not found', 404);
    return t;
}
function attach(u: number, todoId: number, tagId: number) { ownedTodo(u, todoId); ownTag(u, tagId); db.prepare('INSERT OR IGNORE INTO todo_tags(todo_id,tag_id) VALUES(?,?)').run(todoId, tagId); }
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
async function handler(req: NextRequest, context: {
    params: Promise<{
        path: string[];
    }>;
}) {
    const session = await getSession();
    if (!session)
        return json({ error: 'Not authenticated' }, 401);
    try {
        if (!['GET', 'HEAD'].includes(req.method)) {
            const origin = req.headers.get('origin');
            if (origin && origin !== (process.env.RP_ORIGIN || req.nextUrl.origin))
                return json({ error: 'Invalid origin' }, 403);
        }
        const u = session.userId;
        const { path } = await context.params;
        const [resource, part, child] = path;
        const id = Number(part);
        const method = req.method;
        let body: Record<string, unknown> = {};
        if (['POST', 'PUT', 'DELETE'].includes(method) && req.headers.get('content-type')?.includes('json'))
            body = await req.json();
        if (resource === 'holidays' && method === 'GET')
            return json(db.prepare('SELECT * FROM holidays ORDER BY date').all());
        if (resource === 'notifications' && part === 'check' && method === 'GET') {
            const result = db.transaction(() => {
                const now = getSingaporeNow();
                const due = listTodos(u).filter(t => !t.completed && t.due_date && t.reminder_minutes && now.getTime() >= parseSingaporeDate(t.due_date).getTime() - t.reminder_minutes * 60000 && now.getTime() <= parseSingaporeDate(t.due_date).getTime() && (!t.last_notification_sent || parseSingaporeDate(t.last_notification_sent).getTime() < parseSingaporeDate(t.due_date).getTime() - t.reminder_minutes * 60000));
                for (const t of due)
                    db.prepare('UPDATE todos SET last_notification_sent=? WHERE id=? AND user_id=?').run(now.toISOString(), t.id, u);
                return due;
            })();
            return json(result);
        }
        if (resource === 'todos' && part === 'export' && method === 'GET') {
            const todos = listTodos(u);
            const format = req.nextUrl.searchParams.get('format') || 'json';
            if (!['json', 'csv'].includes(format))
                fail('Unsupported export format');
            const filename = `todos-${singaporeInput().slice(0, 10)}.${format}`;
            let output: string;
            if (format === 'json')
                output = JSON.stringify({ version: 1, exported_at: getSingaporeNow().toISOString(), todos: todos.map(t => ({ title: t.title, completed: t.completed, due_date: t.due_date, priority: t.priority, is_recurring: t.is_recurring, recurrence_pattern: t.recurrence_pattern, reminder_minutes: t.reminder_minutes, last_notification_sent: t.last_notification_sent, created_at: t.created_at, updated_at: t.updated_at, subtasks: t.subtasks.map(s => ({ title: s.title, completed: s.completed, position: s.position, created_at: s.created_at })), tags: t.tags.map(g => ({ name: g.name, color: g.color })) })) }, null, 2);
            else {
                const quote = (v: unknown) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
                output = [['ID', 'Title', 'Completed', 'Due Date', 'Priority', 'Recurring', 'Pattern', 'Reminder'], ...todos.map(t => [t.id, t.title, t.completed, t.due_date, t.priority, t.is_recurring, t.recurrence_pattern, t.reminder_minutes])].map(row => row.map(quote).join(',')).join('\r\n');
            }
            return new NextResponse(output, { headers: { 'Content-Type': format === 'json' ? 'application/json' : 'text/csv', 'Content-Disposition': `attachment; filename="${filename}"` } });
        }
        if (resource === 'todos' && part === 'import' && method === 'POST') {
            const imported = z.object({ version: z.literal(1), todos: z.array(fields.extend({ created_at: z.string().datetime({ offset: true }).optional(), updated_at: z.string().datetime({ offset: true }).nullable().optional(), last_notification_sent: z.string().datetime({ offset: true }).nullable().optional(), subtasks: z.array(subSchema.extend({ created_at: z.string().datetime({ offset: true }).optional() })).default([]), tags: z.array(tagSchema).default([]) })).max(10000) }).parse(body);
            for (const t of imported.todos)
                validateTodo(t, false);
            db.transaction(() => {
                for (const t of imported.todos) {
                    const next = insertTodo(u, t, false);
                    db.prepare('UPDATE todos SET created_at=COALESCE(?,created_at),updated_at=?,last_notification_sent=? WHERE id=?').run(t.created_at ?? null, t.updated_at ?? null, t.last_notification_sent ?? null, next);
                    for (const s of t.subtasks)
                        db.prepare("INSERT INTO subtasks(todo_id,title,completed,position,created_at) VALUES(?,?,?,?,COALESCE(?,datetime('now')))").run(next, s.title, +s.completed, s.position, s.created_at ?? null);
                    for (const g of t.tags) {
                        let existing = db.prepare('SELECT * FROM tags WHERE user_id=? AND lower(name)=lower(?)').get(u, g.name) as Tag | undefined;
                        if (!existing) {
                            const n = Number(db.prepare('INSERT INTO tags(user_id,name,color) VALUES(?,?,?)').run(u, g.name, g.color).lastInsertRowid);
                            existing = { ...g, id: n, user_id: u, created_at: '' };
                        }
                        db.prepare('INSERT OR IGNORE INTO todo_tags(todo_id,tag_id) VALUES(?,?)').run(next, existing.id);
                    }
                }
            })();
            return json({ imported: imported.todos.length, count: imported.todos.length });
        }
        if (resource === 'todos' && !part) {
            if (method === 'GET')
                return json(listTodos(u));
            if (method === 'POST') {
                const next = db.transaction(() => {
                    const next = insertTodo(u, body);
                    if (Array.isArray(body.tag_ids))
                        for (const g of body.tag_ids)
                            attach(u, next, z.number().int().positive().parse(g));
                    return next;
                })();
                return json(ownedTodo(u, next), 201);
            }
        }
        if (resource === 'todos' && Number.isSafeInteger(id) && id > 0) {
            const current = ownedTodo(u, id);
            if (child === 'subtasks' && method === 'POST') {
                const s = subSchema.parse(body);
                const position = (db.prepare('SELECT COALESCE(MAX(position),-1)+1 AS p FROM subtasks WHERE todo_id=?').get(id) as {
                    p: number;
                }).p;
                const result = db.prepare('INSERT INTO subtasks(todo_id,title,position) VALUES(?,?,?)').run(id, s.title, position);
                return json({ ...s, id: Number(result.lastInsertRowid), todo_id: id, position }, 201);
            }
            if (child === 'tags' && ['POST', 'DELETE'].includes(method)) {
                const tagId = z.number().int().positive().parse(body.tag_id);
                ownTag(u, tagId);
                if (method === 'POST')
                    attach(u, id, tagId);
                else
                    db.prepare('DELETE FROM todo_tags WHERE todo_id=? AND tag_id=?').run(id, tagId);
                return json(ownedTodo(u, id));
            }
            if (!child && method === 'GET')
                return json(current);
            if (!child && method === 'DELETE') {
                db.prepare('DELETE FROM todos WHERE id=? AND user_id=?').run(id, u);
                return json({ success: true });
            }
            if (!child && method === 'PUT') {
                const t = validateTodo(fields.parse({ ...current, ...body }), Object.hasOwn(body, 'due_date') && body.due_date !== current.due_date);
                db.transaction(() => {
                    db.prepare('UPDATE todos SET title=?,completed=?,due_date=?,priority=?,is_recurring=?,recurrence_pattern=?,reminder_minutes=?,updated_at=?,last_notification_sent=? WHERE id=? AND user_id=?').run(t.title, +t.completed, t.due_date, t.priority, +t.is_recurring, t.recurrence_pattern, t.reminder_minutes, getSingaporeNow().toISOString(), t.due_date !== current.due_date || t.reminder_minutes !== current.reminder_minutes ? null : current.last_notification_sent, id, u);
                    if (!current.completed && t.completed && t.is_recurring) {
                        const next = insertTodo(u, { ...t, completed: false, due_date: calculateNextDueDate(t.due_date!, t.recurrence_pattern!) }, false);
                        for (const g of current.tags)
                            attach(u, next, g.id);
                    }
                    if (Array.isArray(body.tag_ids)) {
                        db.prepare('DELETE FROM todo_tags WHERE todo_id=?').run(id);
                        for (const g of body.tag_ids)
                            attach(u, id, z.number().int().positive().parse(g));
                    }
                })();
                return json(ownedTodo(u, id));
            }
        }
        if (resource === 'subtasks' && Number.isSafeInteger(id)) {
            const s = db.prepare('SELECT s.* FROM subtasks s JOIN todos t ON t.id=s.todo_id WHERE s.id=? AND t.user_id=?').get(id, u) as Subtask | undefined;
            if (!s)
                fail('Subtask not found', 404);
            if (method === 'DELETE') {
                db.prepare('DELETE FROM subtasks WHERE id=?').run(id);
                return json({ success: true });
            }
            if (method === 'PUT') {
                const data = subSchema.parse({ ...s, completed: !!s.completed, ...body });
                db.prepare('UPDATE subtasks SET title=?,completed=?,position=? WHERE id=?').run(data.title, +data.completed, data.position, id);
                return json({ ...s, ...data });
            }
        }
        if (resource === 'tags') {
            if (!part && method === 'GET')
                return json(db.prepare('SELECT * FROM tags WHERE user_id=? ORDER BY name').all(u));
            if (!part && method === 'POST') {
                const t = tagSchema.parse(body);
                if (db.prepare('SELECT id FROM tags WHERE user_id=? AND lower(name)=lower(?)').get(u, t.name))
                    fail('Tag name already exists', 409);
                const n = Number(db.prepare('INSERT INTO tags(user_id,name,color) VALUES(?,?,?)').run(u, t.name, t.color).lastInsertRowid);
                return json(ownTag(u, n), 201);
            }
            if (part) {
                const old = ownTag(u, id);
                if (method === 'DELETE') {
                    db.prepare('DELETE FROM tags WHERE id=? AND user_id=?').run(id, u);
                    return json({ success: true });
                }
                if (method === 'PUT') {
                    const t = tagSchema.parse({ ...old, ...body });
                    if (db.prepare('SELECT id FROM tags WHERE user_id=? AND lower(name)=lower(?) AND id!=?').get(u, t.name, id))
                        fail('Tag name already exists', 409);
                    db.prepare('UPDATE tags SET name=?,color=? WHERE id=? AND user_id=?').run(t.name, t.color, id, u);
                    return json(ownTag(u, id));
                }
            }
        }
        if (resource === 'templates') {
            if (!part && method === 'GET')
                return json((db.prepare('SELECT * FROM templates WHERE user_id=? ORDER BY name').all(u) as Template[]).map(t => ({ ...t, is_recurring: !!t.is_recurring })));
            if (part && child === 'use' && method === 'POST') {
                const t = ownTemplate(u, id);
                const next = db.transaction(() => {
                    const next = insertTodo(u, { title: t.title_template, priority: t.priority, is_recurring: !!t.is_recurring, recurrence_pattern: t.recurrence_pattern, reminder_minutes: t.reminder_minutes, due_date: t.due_date_offset_minutes === null ? null : newDue(t.due_date_offset_minutes) }, false);
                    const subtasks = z.array(subSchema).parse(JSON.parse(t.subtasks_json || '[]'));
                    for (const s of subtasks)
                        db.prepare('INSERT INTO subtasks(todo_id,title,position) VALUES(?,?,?)').run(next, s.title, s.position);
                    return next;
                })();
                return json(ownedTodo(u, next), 201);
            }
            if (part && method === 'DELETE') {
                ownTemplate(u, id);
                db.prepare('DELETE FROM templates WHERE id=? AND user_id=?').run(id, u);
                return json({ success: true });
            }
            if (method === 'POST' || method === 'PUT') {
                let source = body;
                if (method === 'PUT')
                    source = { ...ownTemplate(u, id), is_recurring: !!ownTemplate(u, id).is_recurring, ...body };
                const t = templateSchema.parse(source);
                if (t.subtasks_json !== null)
                    z.array(subSchema).parse(JSON.parse(t.subtasks_json));
                if (t.is_recurring && (!t.recurrence_pattern || t.due_date_offset_minutes === null))
                    fail('Recurring templates need pattern and due date offset');
                if (t.reminder_minutes && t.due_date_offset_minutes === null)
                    fail('Template reminders need due date offset');
                const values = [t.name, t.description, t.category, t.title_template, t.priority, +t.is_recurring, t.recurrence_pattern, t.reminder_minutes, t.due_date_offset_minutes, t.subtasks_json];
                if (method === 'POST') {
                    const next = Number(db.prepare('INSERT INTO templates(name,description,category,title_template,priority,is_recurring,recurrence_pattern,reminder_minutes,due_date_offset_minutes,subtasks_json,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...values, u).lastInsertRowid);
                    return json(ownTemplate(u, next), 201);
                }
                db.prepare('UPDATE templates SET name=?,description=?,category=?,title_template=?,priority=?,is_recurring=?,recurrence_pattern=?,reminder_minutes=?,due_date_offset_minutes=?,subtasks_json=? WHERE id=? AND user_id=?').run(...values, id, u);
                return json(ownTemplate(u, id));
            }
        }
        return json({ error: 'Not found' }, 404);
    }
    catch (error) {
        if (error instanceof z.ZodError)
            return json({ error: error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; ') }, 400);
        if (error instanceof SyntaxError)
            return json({ error: 'Invalid JSON' }, 400);
        const err = error as Error & {
            status?: number;
            code?: string;
        };
        if (err.status)
            return json({ error: err.message }, err.status);
        if (err.code?.startsWith('SQLITE_CONSTRAINT'))
            return json({ error: 'Data conflicts with an existing record' }, 409);
        return json({ error: 'An unexpected server error occurred' }, 500);
    }
}
function newDue(minutes: number) { const now = getSingaporeNow(); now.setTime(now.getTime() + minutes * 60000); return now.toISOString(); }
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
