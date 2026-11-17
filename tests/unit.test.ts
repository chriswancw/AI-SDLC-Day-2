import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextDueDate, parseSingaporeDate, singaporeInput } from '../lib/timezone';
import { applyFilters, emptyFilters } from '../lib/filters';
import type { Todo } from '../lib/db';
const todo = (changes: Partial<Todo> = {}): Todo => ({ id: 1, user_id: 1, title: 'Prepare budget', completed: false, due_date: '2026-11-17T16:30:00+08:00', priority: 'high', is_recurring: false, recurrence_pattern: null, reminder_minutes: null, last_notification_sent: null, created_at: '2026-11-17T00:00:00Z', updated_at: null, subtasks: [{ id: 1, todo_id: 1, title: 'Review figures', completed: false, position: 0, created_at: '' }], tags: [{ id: 7, user_id: 1, name: 'Finance', color: '#3B82F6', created_at: '' }], ...changes });
test('monthly recurrence clamps month-end preserving Singapore clock time', () => { assert.equal(calculateNextDueDate('2027-01-31T09:15:00+08:00', 'monthly'), '2027-02-28T01:15:00.000Z'); assert.equal(calculateNextDueDate('2028-01-31T09:15:00+08:00', 'monthly'), '2028-02-29T01:15:00.000Z'); });
test('yearly recurrence clamps leap day', () => { assert.equal(calculateNextDueDate('2028-02-29T00:30:00+08:00', 'yearly'), '2029-02-27T16:30:00.000Z'); });
test('daily and weekly recurrence cross year boundary', () => { assert.equal(calculateNextDueDate('2026-12-31T22:00:00+08:00', 'daily'), '2027-01-01T14:00:00.000Z'); assert.equal(calculateNextDueDate('2026-12-31T22:00:00+08:00', 'weekly'), '2027-01-07T14:00:00.000Z'); });
test('date-only and local datetimes use Singapore independently of host timezone', () => { assert.equal(parseSingaporeDate('2026-01-01').toISOString(), '2025-12-31T16:00:00.000Z'); assert.equal(parseSingaporeDate('2026-01-01T09:00').toISOString(), '2026-01-01T01:00:00.000Z'); assert.equal(singaporeInput(parseSingaporeDate('2026-01-01T09:00')), '2026-01-01T09:00'); });
test('search includes subtasks and tag names case insensitively', () => { for (const search of ['BUDGET', 'figures', 'FINANCE'])
    assert.equal(applyFilters([todo()], { ...emptyFilters, search }).length, 1); assert.equal(applyFilters([todo()], { ...emptyFilters, search: 'missing' }).length, 0); });
test('filters combine with AND and date range uses Singapore day', () => { const rows = [todo(), todo({ id: 2, priority: 'low' }), todo({ id: 3, completed: true })]; const filters = { ...emptyFilters, search: 'budget', priority: 'high', tagId: 7, completion: 'pending', dueDateFrom: '2026-11-17', dueDateTo: '2026-11-17' }; assert.deepEqual(applyFilters(rows, filters).map(t => t.id), [1]); assert.equal(applyFilters([todo({ due_date: null })], filters).length, 0); });
test('filtering 1000 todos completes within 100ms without modifying input', () => { const rows = Array.from({ length: 1000 }, (_, id) => todo({ id })); const before = performance.now(); const result = applyFilters(rows, { ...emptyFilters, search: 'figures', priority: 'high', tagId: 7 }); assert.equal(result.length, 1000); assert.ok(performance.now() - before < 100); assert.equal(rows.length, 1000); });
import { generateCalendarGrid } from '../lib/calendar';
test('calendar uses full 5/6-week grids with adjacent days', () => {
    const feb = generateCalendarGrid(2026, 1);
    assert.equal(feb.length, 35);
    assert.equal(feb[0].date, '2026-02-01');
    assert.equal(feb.filter(d => d.isCurrentMonth).length, 28);
    assert.equal(feb.at(-1)?.date, '2026-03-07');
    const aug = generateCalendarGrid(2026, 7);
    assert.equal(aug.length, 42);
    assert.equal(aug[0].date, '2026-07-26');
    assert.equal(aug.at(-1)?.date, '2026-09-05');
    assert.ok(aug.filter((_, i) => i % 7 === 0 || i % 7 === 6).every(d => d.isWeekend));
    assert.ok(aug.filter((_, i) => i % 7 !== 0 && i % 7 !== 6).every(d => !d.isWeekend));
});
test('leap calendar and December-to-January boundary remain correct', () => {
    assert.equal(generateCalendarGrid(2028, 1).filter(d => d.isCurrentMonth).length, 29);
    const dec = generateCalendarGrid(2026, 11);
    assert.equal(dec.filter(d => d.isCurrentMonth).length, 31);
    assert.ok(dec.some(d => d.date === '2027-01-01' && !d.isCurrentMonth));
});
