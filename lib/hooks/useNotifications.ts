'use client';
import { useEffect, useState } from 'react';
import type { Todo } from '@/lib/db';
export function useNotifications() { const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default'); useEffect(() => { if (!('Notification' in window)) {
    return;
} void Promise.resolve().then(() => setPermission(Notification.permission)); let active = true; async function check() { if (Notification.permission !== 'granted')
    return; try {
    const res = await fetch('/api/notifications/check');
    if (!res.ok)
        return;
    const data = await res.json();
    const todos: Todo[] = Array.isArray(data) ? data : data.todos ?? [];
    for (const todo of todos) {
        if (!active)
            return;
        new Notification(todo.title, { body: 'Your task is due soon.', tag: `todo-${todo.id}` });
    }
}
catch { /* Retry next polling interval. */ } } void check(); const timer = setInterval(check, 30000); return () => { active = false; clearInterval(timer); }; }, []); return { permission, requestPermission: async () => { if (!('Notification' in window)) {
        setPermission('unsupported');
        return;
    } setPermission(await Notification.requestPermission()); } }; }
