import type { Todo } from './db';
export interface FilterState {
    search: string;
    priority: string;
    tagId: number | null;
    completion: string;
    dueDateFrom: string;
    dueDateTo: string;
}
export const emptyFilters: FilterState = { search: '', priority: '', tagId: null, completion: '', dueDateFrom: '', dueDateTo: '' };
export function applyFilters(todos: Todo[], filters: FilterState): Todo[] { let result = todos; const search = filters.search.trim().toLocaleLowerCase(); if (search)
    result = result.filter(t => [t.title, ...(t.subtasks ?? []).map(s => s.title), ...(t.tags ?? []).map(t => t.name)].some(title => title.toLocaleLowerCase().includes(search))); if (filters.priority)
    result = result.filter(t => t.priority === filters.priority); if (filters.tagId !== null)
    result = result.filter(t => t.tags?.some(tag => tag.id === filters.tagId)); if (filters.completion)
    result = result.filter(t => t.completed === (filters.completion === 'completed')); if (filters.dueDateFrom || filters.dueDateTo)
    result = result.filter(t => { if (!t.due_date)
        return false; const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.parse(t.due_date)); return (!filters.dueDateFrom || date >= filters.dueDateFrom) && (!filters.dueDateTo || date <= filters.dueDateTo); }); return result; }
