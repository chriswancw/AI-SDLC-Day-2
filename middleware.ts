import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/auth';
export async function middleware(request: NextRequest) {
    const session = await verifySession(request.cookies.get('todo-session')?.value);
    if (!session && request.nextUrl.pathname !== '/login')
        return NextResponse.redirect(new URL('/login', request.url));
    if (session && request.nextUrl.pathname === '/login')
        return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
}
export const config = { matcher: ['/', '/calendar', '/login'] };
