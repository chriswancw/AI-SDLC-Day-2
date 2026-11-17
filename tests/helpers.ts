import { test as base, expect, type Page } from '@playwright/test';
import type { Todo, Subtask, Tag, Template } from '../lib/db';
export { expect };
export const future = (minutes = 60) => new Date(Date.now() + minutes * 60000).toISOString();
export async function register(page: Page, username = `user-${crypto.randomUUID()}`) {
    await page.goto('/login');
    const client = await page.context().newCDPSession(page);
    await client.send('WebAuthn.enable');
    await client.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const r = await page.request.post('/api/auth/register-options', { data: { username } });
    expect(r.ok(), await r.text()).toBeTruthy();
    const options = await r.json();
    const response = await page.evaluate(async (opts) => { const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); opts.challenge = decode(opts.challenge); opts.user.id = decode(opts.user.id); opts.excludeCredentials = (opts.excludeCredentials || []).map((c: {
        id: string;
    }) => ({ ...c, id: decode(c.id) })); return (await navigator.credentials.create({ publicKey: opts }) as PublicKeyCredential).toJSON(); }, options);
    const verified = await page.request.post('/api/auth/register-verify', { data: { response } });
    expect(verified.ok(), await verified.text()).toBeTruthy();
    return username;
}
export async function login(page: Page, username: string) {
    const r = await page.request.post('/api/auth/login-options', { data: { username } });
    expect(r.ok(), await r.text()).toBeTruthy();
    const options = await r.json();
    const response = await page.evaluate(async (opts) => { const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); opts.challenge = decode(opts.challenge); opts.allowCredentials = (opts.allowCredentials || []).map((c: {
        id: string;
    }) => ({ ...c, id: decode(c.id) })); return (await navigator.credentials.get({ publicKey: opts }) as PublicKeyCredential).toJSON(); }, options);
    const verified = await page.request.post('/api/auth/login-verify', { data: { response } });
    expect(verified.ok(), await verified.text()).toBeTruthy();
}
export async function createTodo(page: Page, data: Record<string, unknown> = {}): Promise<Todo> { const r = await page.request.post('/api/todos', { data: { title: 'Plan the week', ...data } }); expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); }
export async function addSubtask(page: Page, id: number, title = 'First step'): Promise<Subtask> { const r = await page.request.post(`/api/todos/${id}/subtasks`, { data: { title } }); expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); }
export async function createTag(page: Page, name = 'Work'): Promise<Tag> { const r = await page.request.post('/api/tags', { data: { name, color: '#3B82F6' } }); expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); }
export async function createTemplate(page: Page, data: Record<string, unknown> = {}): Promise<Template> { const r = await page.request.post('/api/templates', { data: { name: 'Morning routine', title_template: 'Start the day', priority: 'high', subtasks_json: JSON.stringify([{ title: 'Prepare', position: 2 }]), ...data } }); expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); }
export async function todos(page: Page): Promise<Todo[]> { return (await page.request.get('/api/todos')).json(); }
export const test = base.extend<{
    username: string;
}>({ username: [async ({ page }, use) => { await use(await register(page)); }, { auto: true }] });
