'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Todo, Tag, Template, Priority } from '@/lib/db';
import { getSingaporeNow, formatSingaporeDate, parseSingaporeDate, singaporeInput } from '@/lib/timezone';
import { applyFilters, emptyFilters, type FilterState } from '@/lib/filters';
import { useNotifications } from '@/lib/hooks/useNotifications';
type Draft = {
    title: string;
    priority: Priority;
    due_date: string;
    recurrence_pattern: string;
    reminder_minutes: string;
    tagIds: number[];
};
type Preset = {
    id: string;
    name: string;
    filters: FilterState;
    createdAt: string;
};
const blank: Draft = { title: '', priority: 'medium', due_date: '', recurrence_pattern: '', reminder_minutes: '', tagIds: [] };
const reminderLabels: Record<number, string> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h', 1440: '1d', 2880: '2d', 10080: '1w' };
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> { const res = await fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); const value = await res.json(); if (!res.ok)
    throw Error(value.error ?? 'Something went wrong'); return value; }
function Modal({ title, close, children }: {
    title: string;
    close: () => void;
    children: React.ReactNode;
}) { useEffect(() => { const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; const dialog = document.querySelector<HTMLElement>('[role="dialog"]'); const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0); const listener = (e: KeyboardEvent) => { if (e.key === 'Escape')
    close(); if (e.key === 'Tab') {
    const elements = focusable();
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) {
        e.preventDefault();
        return;
    }
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
} }; document.addEventListener('keydown', listener); focusable()[0]?.focus(); return () => { document.removeEventListener('keydown', listener); previous?.focus(); }; }, [close]); return <div className="modal-shade" onClick={e => { if (e.target === e.currentTarget)
    close(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={close} aria-label="Close dialog">?</button></header>{children}</section></div>; }
export default function Home() {
    const router = useRouter();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft>(blank);
    const [editing, setEditing] = useState<Todo | null>(null);
    const [composer, setComposer] = useState(false);
    const [manageTags, setManageTags] = useState(false);
    const [manageTemplates, setManageTemplates] = useState(false);
    const [tagEdit, setTagEdit] = useState<Tag | null>(null);
    const [tagName, setTagName] = useState('');
    const [tagColor, setTagColor] = useState('#3B82F6');
    const [templateSource, setTemplateSource] = useState<Todo | null>(null);
    const [templateEdit, setTemplateEdit] = useState<Template | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [templateCategory, setTemplateCategory] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [filters, setFilters] = useState<FilterState>(emptyFilters);
    const [search, setSearch] = useState('');
    const [presets, setPresets] = useState<Preset[]>([]);
    const [presetName, setPresetName] = useState('');
    const [now, setNow] = useState(() => getSingaporeNow().getTime());
    const [expanded, setExpanded] = useState<number[]>([]);
    const [subtaskDrafts, setSubtaskDrafts] = useState<Record<number, string>>({});
    const { permission, requestPermission } = useNotifications();
    const reload = useCallback(async () => { const [t, g, p] = await Promise.all([api<Todo[]>('/api/todos'), api<Tag[]>('/api/tags'), api<Template[]>('/api/templates')]); setTodos(t); setTags(g); setTemplates(p); }, []);
    useEffect(() => { Promise.resolve().then(() => Promise.all([reload(), api<{
            username: string;
        }>('/api/auth/me').then(u => setUsername(u.username))])).catch(e => setError(e.message)).finally(() => setLoading(false)); try {
        const stored = JSON.parse(localStorage.getItem('todo-app:filter-presets') ?? '[]');
        if (Array.isArray(stored))
            void Promise.resolve().then(() => setPresets(stored));
    }
    catch { /* Ignore corrupted saved preferences. */ } const timer = setInterval(() => setNow(getSingaporeNow().getTime()), 30000); return () => clearInterval(timer); }, [reload]);
    useEffect(() => { const timer = setTimeout(() => setFilters(f => ({ ...f, search })), 300); return () => clearTimeout(timer); }, [search]);
    async function action(work: () => Promise<unknown>, success = '') { setError(''); setMessage(''); setBusy(true); try {
        await work();
        await reload();
        if (success)
            setMessage(success);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
    }
    finally {
        setBusy(false);
    } }
    const closeComposer = useCallback(() => { setComposer(false); setEditing(null); setDraft(blank); }, []);
    const closeTags = useCallback(() => setManageTags(false), []);
    const closeTemplates = useCallback(() => setManageTemplates(false), []);
    const closeSaveTemplate = useCallback(() => { setTemplateSource(null); setTemplateEdit(null); }, []);
    function openEdit(todo: Todo) { setEditing(todo); setDraft({ title: todo.title, priority: todo.priority, due_date: todo.due_date ? singaporeInput(parseSingaporeDate(todo.due_date)) : '', recurrence_pattern: todo.recurrence_pattern ?? '', reminder_minutes: todo.reminder_minutes?.toString() ?? '', tagIds: (todo.tags ?? []).map(t => t.id) }); setComposer(true); }
    async function saveTodo(e: React.FormEvent) { e.preventDefault(); await action(async () => { const payload = { title: draft.title, priority: draft.priority, due_date: editing?.due_date && draft.due_date === singaporeInput(parseSingaporeDate(editing.due_date)) ? editing.due_date : draft.due_date ? `${draft.due_date}:00+08:00` : null, is_recurring: !!draft.recurrence_pattern, recurrence_pattern: draft.recurrence_pattern || null, reminder_minutes: draft.due_date && draft.reminder_minutes ? Number(draft.reminder_minutes) : null }; const saved = await api<Todo>(editing ? `/api/todos/${editing.id}` : '/api/todos', editing ? 'PUT' : 'POST', payload); const id = editing?.id ?? saved.id; for (const tag of tags) {
        const before = editing?.tags?.some(t => t.id === tag.id) ?? false;
        const after = draft.tagIds.includes(tag.id);
        if (before !== after)
            await api(`/api/todos/${id}/tags`, after ? 'POST' : 'DELETE', { tag_id: tag.id });
    } closeComposer(); }, editing ? 'Task updated.' : 'A little more clarity. Task added.'); }
    async function toggle(todo: Todo) { const original = todos; setTodos(items => items.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t)); try {
        await api(`/api/todos/${todo.id}`, 'PUT', { completed: !todo.completed });
        await reload();
    }
    catch (e) {
        setTodos(original);
        setError(e instanceof Error ? e.message : 'Could not update task');
    } }
    async function toggleSubtask(todoId: number, subtaskId: number, completed: boolean) { const original = todos; setTodos(items => items.map(todo => todo.id === todoId ? { ...todo, subtasks: todo.subtasks?.map(sub => sub.id === subtaskId ? { ...sub, completed } : sub) } : todo)); try {
        await api(`/api/subtasks/${subtaskId}`, 'PUT', { completed });
        await reload();
    }
    catch (e) {
        setTodos(original);
        setError(e instanceof Error ? e.message : 'Could not update subtask');
    } }
    async function remove(todo: Todo) { const original = todos; setTodos(items => items.filter(t => t.id !== todo.id)); try {
        await api(`/api/todos/${todo.id}`, 'DELETE');
    }
    catch (e) {
        setTodos(original);
        setError(e instanceof Error ? e.message : 'Could not delete task');
    } }
    const filtered = useMemo(() => applyFilters(todos, filters), [todos, filters]);
    const sorted = useMemo(() => [...filtered].sort((a, b) => { const ranks = { high: 0, medium: 1, low: 2 }; return ranks[a.priority] - ranks[b.priority] || (a.due_date ? Date.parse(a.due_date) : Infinity) - (b.due_date ? Date.parse(b.due_date) : Infinity) || Date.parse(b.created_at) - Date.parse(a.created_at); }), [filtered]);
    const sections = [{ name: 'Overdue', hint: 'A fresh start is always possible.', items: sorted.filter(t => !t.completed && t.due_date && Date.parse(t.due_date) < now) }, { name: 'Pending', hint: 'One thing at a time.', items: sorted.filter(t => !t.completed && (!t.due_date || Date.parse(t.due_date) >= now)) }, { name: 'Completed', hint: 'Small wins add up.', items: sorted.filter(t => t.completed) }];
    const completed = todos.filter(t => t.completed).length;
    function savePresets(next: Preset[]) { setPresets(next); localStorage.setItem('todo-app:filter-presets', JSON.stringify(next)); }
    function clearFilters() { setFilters(emptyFilters); setSearch(''); }
    function beginTemplate(todo: Todo) { setTemplateSource(todo); setTemplateEdit(null); setTemplateName(todo.title); setTemplateDescription(''); setTemplateCategory(''); }
    function editTemplate(template: Template) { setManageTemplates(false); setTemplateEdit(template); setTemplateSource(null); setTemplateName(template.name); setTemplateDescription(template.description ?? ''); setTemplateCategory(template.category ?? ''); }
    return <div className="app-shell"><aside className="sidebar"><Link href="/" className="brand">◒ <span>daylight</span></Link><p className="eyebrow nav-heading">YOUR SPACE</p><nav><Link className="active" href="/">☷ <span>My tasks</span><span className="nav-count">{todos.filter(t => !t.completed).length}</span></Link><Link href="/calendar">▦ <span>Calendar</span></Link><button onClick={() => setManageTemplates(true)}>▧ <span>Templates</span></button><button onClick={() => setManageTags(true)}>◇ <span>Manage Tags</span></button></nav><div className="sidebar-note"><span>✦</span><p>A little progress<br />is still progress.</p></div><div className="profile"><span className="avatar">{username.slice(0, 1).toUpperCase() || 'D'}</span><div><strong>{username || 'Your space'}</strong><span className="small muted">Personal workspace</span></div><button aria-label="Log out" title="Log out" onClick={() => void action(async () => { await api('/api/auth/logout', 'POST'); router.push('/login'); router.refresh(); })}>↪</button></div></aside><main className="main"><header className="topbar"><span>My workspace <span className="muted">/ My tasks</span></span><span className="small muted">Singapore · {new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' }).format(now)}</span></header><div className="content"><div className="page-heading"><div><p className="eyebrow">A CLEARER DAY STARTS HERE</p><h1>Your everyday, in order<span className="accent">.</span></h1><p className="muted">A place for everything on your mind. Make it a good day.</p></div><button className="primary" onClick={() => { setDraft(blank); setEditing(null); setComposer(true); }}>＋ Add task</button></div><div className="stats"><div><span className="stat-icon peach">☷</span><div><strong>{todos.filter(t => !t.completed).length}</strong><span>To focus on</span></div></div><div><span className="stat-icon lavender">✓</span><div><strong>{completed}</strong><span>Small wins</span></div></div><div><span className="stat-icon mint">◷</span><div><strong>{todos.filter(t => !t.completed && t.due_date && singaporeInput(parseSingaporeDate(t.due_date)).slice(0, 10) === singaporeInput(getSingaporeNow()).slice(0, 10)).length}</strong><span>Due today</span></div></div></div><section className="workspace"><div className="workspace-toolbar"><h2>All tasks <span className="count">{todos.length}</span></h2><div className="toolbar-actions"><button onClick={() => void requestPermission()} disabled={permission === 'granted' || permission === 'unsupported'} title="Enable browser reminders">♧ {permission === 'granted' ? 'Notifications on' : 'Enable notifications'}</button><details className="export-menu"><summary>Export ↓</summary><div><a download href="/api/todos/export?format=json">Export JSON</a><a download href="/api/todos/export?format=csv">Export CSV</a></div></details><label className="button import-button">Import ↑<input type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if (file)
        void action(async () => { let data; try {
            data = JSON.parse(await file.text());
        }
        catch {
            throw Error('Please choose a valid JSON file.');
        } const result = await api<{
            count?: number;
            imported?: number;
        }>('/api/todos/import', 'POST', data); setMessage(`Imported ${result.count ?? result.imported ?? 'your'} tasks.`); }); e.target.value = ''; }}/></label></div></div><div className="filters"><label className="search-field"><span>⌕</span><input aria-label="Search todos" placeholder="Search your tasks…" value={search} onChange={e => setSearch(e.target.value)}/><kbd>⌕</kbd></label><select aria-label="Filter priority" value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}><option value="">All priorities</option>{['high', 'medium', 'low'].map(p => <option key={p}>{p}</option>)}</select><select aria-label="Filter tag" value={filters.tagId ?? ''} onChange={e => setFilters({ ...filters, tagId: e.target.value ? Number(e.target.value) : null })}><option value="">All tags</option>{tags.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select><select aria-label="Filter completion" value={filters.completion} onChange={e => setFilters({ ...filters, completion: e.target.value })}><option value="">Any status</option><option value="pending">Pending</option><option value="completed">Completed</option></select></div><details className="advanced"><summary>Date range & saved views</summary><div className="advanced-row"><label>From<input type="date" value={filters.dueDateFrom} onChange={e => setFilters({ ...filters, dueDateFrom: e.target.value })}/></label><label>To<input type="date" value={filters.dueDateTo} onChange={e => setFilters({ ...filters, dueDateTo: e.target.value })}/></label><label>View name<input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="e.g. This week"/></label><button disabled={!presetName.trim()} onClick={() => { savePresets([...presets, { id: crypto.randomUUID(), name: presetName.trim(), filters, createdAt: getSingaporeNow().toISOString() }]); setPresetName(''); }}>Save view</button></div><div className="preset-list">{presets.map(p => <span key={p.id}><button onClick={() => { setFilters(p.filters); setSearch(p.filters.search); }}>{p.name}</button><button aria-label={`Delete view ${p.name}`} onClick={() => savePresets(presets.filter(x => x.id !== p.id))}>×</button></span>)}</div></details><div className="filter-status"><span>{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'} in view</span><button className="text-button" onClick={clearFilters}>Clear filters</button></div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}{loading ? <div className="empty">Gathering your day…</div> : filtered.length === 0 ? <div className="empty"><span className="empty-icon">◒</span><h3>{todos.length ? 'Nothing here just yet.' : 'A little space for a fresh start.'}</h3><p>{todos.length ? 'Try another search or clear your filters.' : 'Add your first task and take the day one step at a time.'}</p><button className="primary" onClick={() => setComposer(true)}>＋ Add task</button></div> : sections.map(section => section.items.length > 0 && <section key={section.name} className="task-section"><div className="section-heading"><h3>{section.name} <span>{section.items.length}</span></h3><span className="small muted">{section.hint}</span></div>{section.items.map(todo => { const subtasks = todo.subtasks ?? []; const done = subtasks.filter(s => s.completed).length; const isExpanded = expanded.includes(todo.id); return <article className={`task ${todo.completed ? 'task-completed' : ''}`} key={todo.id}><div className="task-main"><input className="task-check" type="checkbox" aria-label={`Complete ${todo.title}`} checked={todo.completed} onChange={() => void toggle(todo)}/><div className="task-info"><button className="task-title" onClick={() => setExpanded(isExpanded ? expanded.filter(id => id !== todo.id) : [...expanded, todo.id])}>{todo.title}</button><div className="badges"><span className={`badge priority-${todo.priority}`}>{todo.priority}</span>{todo.due_date && <span className={`due ${!todo.completed && Date.parse(todo.due_date) < now ? 'overdue' : ''}`}>◷ {formatSingaporeDate(todo.due_date)}</span>}{todo.is_recurring && <span className="badge recurring">↻ {todo.recurrence_pattern}</span>}{todo.reminder_minutes && <span className="badge">♧ {reminderLabels[todo.reminder_minutes]}</span>}{todo.tags?.map(tag => <button className="tag-badge" key={tag.id} onClick={() => setFilters({ ...filters, tagId: tag.id })}><span style={{ backgroundColor: tag.color }}/>{tag.name}</button>)}</div>{subtasks.length > 0 && <div className="progress-wrap"><progress className={done === subtasks.length ? 'progress-complete' : ''} value={done} max={subtasks.length}/><span>{done}/{subtasks.length} subtasks</span></div>}</div><div className="task-actions"><button aria-label={`Edit ${todo.title}`} title="Edit task" onClick={() => openEdit(todo)}>✎</button><button aria-label={`Save ${todo.title} as template`} title="Save as Template" onClick={() => beginTemplate(todo)}>▧</button><button aria-label={`Delete ${todo.title}`} title="Delete task" onClick={() => void remove(todo)}>×</button></div></div>{isExpanded && <div className="subtasks"><h4>Break it into small steps</h4>{subtasks.map(sub => <div className="subtask" key={sub.id}><input type="checkbox" checked={sub.completed} aria-label={`Complete subtask ${sub.title}`} onChange={() => void toggleSubtask(todo.id, sub.id, !sub.completed)}/><span className={sub.completed ? 'strike' : ''}>{sub.title}</span><button aria-label={`Delete subtask ${sub.title}`} onClick={() => void action(() => api(`/api/subtasks/${sub.id}`, 'DELETE'))}>×</button></div>)}<form className="inline-form" onSubmit={e => { e.preventDefault(); void action(async () => { await api(`/api/todos/${todo.id}/subtasks`, 'POST', { title: subtaskDrafts[todo.id] }); setSubtaskDrafts({ ...subtaskDrafts, [todo.id]: '' }); }); }}><input aria-label={`New subtask for ${todo.title}`} placeholder="Add a small step…" required value={subtaskDrafts[todo.id] ?? ''} onChange={e => setSubtaskDrafts({ ...subtaskDrafts, [todo.id]: e.target.value })}/><button disabled={busy}>Add subtask</button></form></div>}</article>; })}</section>)}</section><footer className="page-footer"><span>One thing at a time. You’re doing fine.</span><span>Made for a little more daylight ◒</span></footer></div></main>
    {composer && <Modal title={editing ? 'Edit task' : 'Make a little plan'} close={closeComposer}><form onSubmit={saveTodo} className="form-stack"><label>Task title<input autoFocus required maxLength={500} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="What’s on your mind?"/></label><div className="form-row"><label>Priority<select aria-label="Priority" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Priority })}>{['high', 'medium', 'low'].map(p => <option key={p}>{p}</option>)}</select></label><label>Due date (Singapore)<input type="datetime-local" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })}/></label></div><div className="form-row"><label>Repeat<select aria-label="Repeat" value={draft.recurrence_pattern} onChange={e => setDraft({ ...draft, recurrence_pattern: e.target.value })}><option value="">Does not repeat</option>{['daily', 'weekly', 'monthly', 'yearly'].map(p => <option key={p}>{p}</option>)}</select></label><label>Reminder<select aria-label="Reminder" disabled={!draft.due_date} value={draft.reminder_minutes} onChange={e => setDraft({ ...draft, reminder_minutes: e.target.value })}><option value="">No reminder</option>{Object.entries(reminderLabels).map(([n, label]) => <option key={n} value={n}>{label} before</option>)}</select></label></div>{tags.length > 0 && <fieldset><legend>Tags</legend><div className="tag-choices">{tags.map(tag => <label key={tag.id}><input type="checkbox" checked={draft.tagIds.includes(tag.id)} onChange={e => setDraft({ ...draft, tagIds: e.target.checked ? [...draft.tagIds, tag.id] : draft.tagIds.filter(id => id !== tag.id) })}/>{tag.name}</label>)}</div></fieldset>}{error && <p className="error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" onClick={closeComposer}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</button></div></form></Modal>}
    {manageTags && <Modal title="Manage Tags" close={closeTags}><p className="muted">Give your tasks a little context.</p><form className="form-stack" onSubmit={e => { e.preventDefault(); void action(async () => { await api(tagEdit ? `/api/tags/${tagEdit.id}` : '/api/tags', tagEdit ? 'PUT' : 'POST', { name: tagName, color: tagColor }); setTagName(''); setTagEdit(null); }, 'Tag saved.'); }}><div className="form-row"><label>Tag name<input required value={tagName} onChange={e => setTagName(e.target.value)} placeholder="e.g. Personal"/></label><label>Tag color<input type="color" value={tagColor} onChange={e => setTagColor(e.target.value)}/></label></div><button className="primary" disabled={busy}>{tagEdit ? 'Save tag' : 'Create tag'}</button></form>{tags.map(tag => <div className="manage-row" key={tag.id}><span className="tag-badge"><span style={{ backgroundColor: tag.color }}/>{tag.name}</span><button onClick={() => { setTagEdit(tag); setTagName(tag.name); setTagColor(tag.color); }}>Edit</button><button onClick={() => void action(() => api(`/api/tags/${tag.id}`, 'DELETE'), 'Tag deleted.')}>Delete</button></div>)}{error && <p className="error" role="alert">{error}</p>}</Modal>}
    {manageTemplates && <Modal title="Your templates" close={closeTemplates}><p className="muted">A head start for the things you do often. Save any task as a template using its ▧ button.</p><label>Category<select aria-label="Category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">All categories</option>{[...new Set(templates.map(t => t.category).filter(Boolean))].map(c => <option key={c}>{c}</option>)}</select></label>{templates.filter(t => !categoryFilter || t.category === categoryFilter).map(t => <article className="template-card" key={t.id}><h3>{t.name}</h3><p>{t.description}</p><div className="badges"><span className={`badge priority-${t.priority}`}>{t.priority}</span><span className="badge">{t.category || 'Uncategorised'}</span>{t.recurrence_pattern && <span className="badge recurring">↻ {t.recurrence_pattern}</span>}</div><p className="small muted">{t.title_template} · {t.subtasks_json ? JSON.parse(t.subtasks_json).length : 0} subtasks{t.due_date_offset_minutes !== null ? ` · Due in ${t.due_date_offset_minutes} minutes` : ''}</p><div className="button-row"><button className="primary" onClick={() => void action(async () => { await api(`/api/templates/${t.id}/use`, 'POST'); setManageTemplates(false); }, 'Task created from template.')}>Use template</button><button onClick={() => editTemplate(t)}>Edit</button><button onClick={() => void action(() => api(`/api/templates/${t.id}`, 'DELETE'))}>Delete</button></div></article>)}{templates.length === 0 && <p className="empty">Your reusable routines will live here.</p>}{error && <p className="error" role="alert">{error}</p>}</Modal>}
    {(templateSource || templateEdit) && <Modal title={templateEdit ? 'Edit template' : 'Save as Template'} close={closeSaveTemplate}><form className="form-stack" onSubmit={e => { e.preventDefault(); void action(async () => { const source = templateSource; const payload = source ? { name: templateName, description: templateDescription || null, category: templateCategory || null, title_template: source.title, priority: source.priority, is_recurring: source.is_recurring, recurrence_pattern: source.recurrence_pattern, reminder_minutes: source.reminder_minutes, due_date_offset_minutes: source.due_date ? Math.max(1, Math.round((Date.parse(source.due_date) - getSingaporeNow().getTime()) / 60000)) : null, subtasks_json: JSON.stringify((source.subtasks ?? []).map(s => ({ title: s.title, position: s.position }))) } : { ...templateEdit, name: templateName, description: templateDescription || null, category: templateCategory || null }; await api(templateEdit ? `/api/templates/${templateEdit.id}` : '/api/templates', templateEdit ? 'PUT' : 'POST', payload); closeSaveTemplate(); }, 'Template saved.'); }}><label>Template name<input required value={templateName} onChange={e => setTemplateName(e.target.value)}/></label><label>Description<textarea value={templateDescription} onChange={e => setTemplateDescription(e.target.value)}/></label><label>Category<input value={templateCategory} onChange={e => setTemplateCategory(e.target.value)}/></label><p className="small muted">Includes task settings and subtasks. Due dates become a relative offset; tags stay with the original task.</p>{error && <p className="error" role="alert">{error}</p>}<div className="modal-footer"><button type="button" onClick={closeSaveTemplate}>Cancel</button><button className="primary" disabled={busy}>Save template</button></div></form></Modal>}
    </div>;
}
