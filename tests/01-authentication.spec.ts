import { test as plain, expect } from '@playwright/test';
import { test, login } from './helpers';
plain('anonymous pages and APIs protected', async ({ page }) => { await page.goto('/'); await expect(page).toHaveURL(/\/login/); await page.goto('/calendar'); await expect(page).toHaveURL(/\/login/); const r = await page.request.get('/api/todos'); expect(r.status()).toBe(401); expect(await r.json()).toEqual({ error: 'Not authenticated' }); });
test('registration, session cookie, logout and passkey login', async ({ page, username }) => { expect((await page.request.get('/api/auth/me')).ok()).toBeTruthy(); const cookies = await page.context().cookies(); expect(cookies.some(c => c.httpOnly && c.sameSite === 'Lax')).toBe(true); await page.goto('/login'); await expect(page).toHaveURL(/\/$/); await page.request.post('/api/auth/logout'); expect((await page.request.get('/api/todos')).status()).toBe(401); await page.goto('/login'); await login(page, username); expect((await page.request.get('/api/auth/me')).ok()).toBeTruthy(); });
test('invalid assertion rejected', async ({ page }) => { await page.request.post('/api/auth/logout'); const r = await page.request.post('/api/auth/login-verify', { data: { response: {} } }); expect(r.status()).toBeGreaterThanOrEqual(400); expect((await page.request.get('/api/todos')).status()).toBe(401); });
plain('every protected API surface rejects anonymous requests before validation', async ({ request }) => {
    const cases: [
        string,
        string
    ][] = [['GET', '/api/auth/me'], ['GET', '/api/todos'], ['POST', '/api/todos'], ['GET', '/api/todos/1'], ['PUT', '/api/todos/1'], ['DELETE', '/api/todos/1'], ['POST', '/api/todos/1/subtasks'], ['PUT', '/api/subtasks/1'], ['DELETE', '/api/subtasks/1'], ['GET', '/api/tags'], ['POST', '/api/tags'], ['PUT', '/api/tags/1'], ['DELETE', '/api/tags/1'], ['POST', '/api/todos/1/tags'], ['DELETE', '/api/todos/1/tags'], ['GET', '/api/templates'], ['POST', '/api/templates'], ['PUT', '/api/templates/1'], ['DELETE', '/api/templates/1'], ['POST', '/api/templates/1/use'], ['GET', '/api/todos/export'], ['POST', '/api/todos/import'], ['GET', '/api/holidays'], ['GET', '/api/notifications/check']];
    for (const [method, url] of cases) {
        const r = await request.fetch(url, { method, ...(method === 'GET' ? {} : { data: {} }) });
        expect(r.status(), `${method} ${url}`).toBe(401);
        expect(await r.json()).toEqual({ error: 'Not authenticated' });
    }
});
