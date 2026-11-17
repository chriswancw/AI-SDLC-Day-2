import { test, expect, createTodo, future } from './helpers';
test('calendar URL month renders scheduled todo and handles invalid month', async ({ page }) => { const due_date = future(120); await createTodo(page, { title: 'Calendar appointment', due_date }); const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit' }).formatToParts(new Date(due_date)); const month = `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`; await page.goto(`/calendar?month=${month}`); await expect(page.getByText('Calendar appointment', { exact: true }).first()).toBeVisible(); expect((await page.request.get('/api/holidays')).ok()).toBeTruthy(); await page.goto('/calendar?month=garbage'); await expect(page.getByRole('main')).toBeVisible(); });
test('calendar navigation, day dialog and holiday display', async ({ page }) => {
    await createTodo(page, { title: 'New year planning', due_date: '2027-01-01T10:00:00+08:00' });
    await page.goto('/calendar?month=2027-01');
    await expect(page.getByRole('heading', { name: 'January 2027', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /2027-01-01/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('New year planning', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page).toHaveURL(/month=2027-02/);
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page).toHaveURL(/month=2027-01/);
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    const current = new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', month: 'long', year: 'numeric' }).format(Date.now());
    await expect(page.getByRole('heading', { name: current, exact: true })).toBeVisible();
    const holidays = await (await page.request.get('/api/holidays')).json();
    expect(holidays.length).toBeGreaterThan(0);
    {
        const holiday = holidays[0];
        await page.goto(`/calendar?month=${holiday.date.slice(0, 7)}`);
        await expect(page.getByText(holiday.name, { exact: true }).first()).toBeVisible();
    }
});
