import { getSingaporeNow, parseSingaporeDate, singaporeInput } from './timezone';
export interface CalendarDay {
    date: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    isWeekend: boolean;
}
export function generateCalendarGrid(year: number, month: number): CalendarDay[] { const first = parseSingaporeDate(`${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-01T00:00:00Z`); const today = singaporeInput(getSingaporeNow()).slice(0, 10); const nextMonth = month === 11 ? `${year + 1}-01` : `${year}-${String(month + 2).padStart(2, '0')}`; const next = parseSingaporeDate(`${nextMonth}-01T00:00:00Z`); const length = Math.round((next.getTime() - first.getTime()) / 86400000); const count = Math.max(35, Math.ceil((first.getUTCDay() + length) / 7) * 7); return Array.from({ length: count }, (_, i) => { const time = first.getTime() + (i - first.getUTCDay()) * 86400000; const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time); const day = Number(date.slice(8, 10)); const weekDay = i % 7; return { date, day, isCurrentMonth: date.slice(0, 7) === `${year}-${String(month + 1).padStart(2, '0')}`, isToday: date === today, isPast: date < today, isWeekend: weekDay === 0 || weekDay === 6 }; }); }
