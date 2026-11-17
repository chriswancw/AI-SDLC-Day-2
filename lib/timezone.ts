import type { RecurrencePattern } from './db';
export const getSingaporeNow = () => new Date();
export function parseSingaporeDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
    if (!match)
        return new Date(NaN);
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || Number(match[4] || 0) > 23 || Number(match[5] || 0) > 59 || Number(match[6] || 0) > 59)
        return new Date(NaN);
    const normalized = value.length === 10 ? value + 'T00:00:00' : value.replace(' ', 'T');
    return new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(normalized) ? normalized : normalized + '+08:00');
}
export function formatSingaporeDate(value: string | Date): string { return new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' }).format(typeof value === 'string' ? parseSingaporeDate(value) : value); }
export function singaporeInput(value: Date = getSingaporeNow()): string { return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 16); }
export function calculateNextDueDate(current: string, pattern: RecurrencePattern): string {
    const date = parseSingaporeDate(current);
    const local = new Date(date.getTime() + 8 * 3600000);
    if (pattern === 'daily' || pattern === 'weekly')
        local.setUTCDate(local.getUTCDate() + (pattern === 'daily' ? 1 : 7));
    else {
        const day = local.getUTCDate();
        local.setUTCDate(1);
        if (pattern === 'monthly')
            local.setUTCMonth(local.getUTCMonth() + 1);
        else
            local.setUTCFullYear(local.getUTCFullYear() + 1);
        const end = new Date(local.getTime());
        end.setUTCMonth(end.getUTCMonth() + 1, 0);
        local.setUTCDate(Math.min(day, end.getUTCDate()));
    }
    return new Date(local.getTime() - 8 * 3600000).toISOString();
}
