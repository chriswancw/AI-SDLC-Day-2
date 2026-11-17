export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;
export interface Session {
    userId: number;
    username: string;
}
export interface User {
    id: number;
    username: string;
    created_at: string;
}
export interface Authenticator {
    id: number;
    user_id: number;
    credential_id: string;
    credential_public_key: Buffer;
    counter: number;
    created_at: string;
}
export interface Subtask {
    id: number;
    todo_id: number;
    title: string;
    completed: boolean;
    position: number;
    created_at: string;
}
export interface Tag {
    id: number;
    user_id: number;
    name: string;
    color: string;
    created_at: string;
}
export interface Todo {
    id: number;
    user_id: number;
    title: string;
    completed: boolean;
    due_date: string | null;
    priority: Priority;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: number | null;
    last_notification_sent: string | null;
    created_at: string;
    updated_at: string | null;
    subtasks: Subtask[];
    tags: Tag[];
}
export interface Template {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    category: string | null;
    title_template: string;
    priority: Priority;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: number | null;
    due_date_offset_minutes: number | null;
    subtasks_json: string | null;
    created_at: string;
}
export interface Holiday {
    id: number;
    date: string;
    name: string;
}
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
const location = process.env.DATABASE_PATH || path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd(), 'todos.db');
fs.mkdirSync(path.dirname(location), { recursive: true });
const db = new Database(location);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS authenticators (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,credential_id TEXT UNIQUE NOT NULL,credential_public_key BLOB NOT NULL,counter INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,due_date TEXT,priority TEXT NOT NULL DEFAULT 'medium',is_recurring INTEGER NOT NULL DEFAULT 0,recurrence_pattern TEXT,reminder_minutes INTEGER,last_notification_sent TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT);
CREATE TABLE IF NOT EXISTS subtasks (id INTEGER PRIMARY KEY AUTOINCREMENT,todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,title TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,position INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,color TEXT NOT NULL DEFAULT '#3B82F6',created_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(user_id,name));
CREATE TABLE IF NOT EXISTS todo_tags (todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,PRIMARY KEY(todo_id,tag_id));
CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT,category TEXT,title_template TEXT NOT NULL,priority TEXT NOT NULL DEFAULT 'medium',is_recurring INTEGER NOT NULL DEFAULT 0,recurrence_pattern TEXT,reminder_minutes INTEGER,due_date_offset_minutes INTEGER,subtasks_json TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS holidays (id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL UNIQUE,name TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
`);
export default db;
function utcTimestamp(value: string): string { return value.includes('T') ? value : value.replace(' ', 'T') + 'Z'; }
export function listTodos(userId: number): Todo[] {
    const todos = db.prepare('SELECT * FROM todos WHERE user_id=?').all(userId) as Todo[];
    const subtasks = db.prepare('SELECT s.* FROM subtasks s JOIN todos t ON s.todo_id=t.id WHERE t.user_id=? ORDER BY s.position,s.id').all(userId) as Subtask[];
    const tags = db.prepare('SELECT g.*,j.todo_id FROM tags g JOIN todo_tags j ON j.tag_id=g.id WHERE g.user_id=?').all(userId) as (Tag & {
        todo_id: number;
    })[];
    return todos.map(t => ({ ...t, created_at: utcTimestamp(t.created_at), completed: !!t.completed, is_recurring: !!t.is_recurring, subtasks: subtasks.filter(s => s.todo_id === t.id).map(s => ({ ...s, created_at: utcTimestamp(s.created_at), completed: !!s.completed })), tags: tags.filter(g => g.todo_id === t.id).map(g => ({ id: g.id, user_id: g.user_id, name: g.name, color: g.color, created_at: g.created_at })) }));
}
export const todoDB = { list: listTodos };
export const tagDB = { list: (u: number) => db.prepare('SELECT * FROM tags WHERE user_id=?').all(u) };
export const subtaskDB = { list: (id: number) => db.prepare('SELECT * FROM subtasks WHERE todo_id=? ORDER BY position').all(id) };
export const templateDB = { list: (u: number) => db.prepare('SELECT * FROM templates WHERE user_id=?').all(u) };
export const holidayDB = { list: () => db.prepare('SELECT * FROM holidays ORDER BY date').all() };
