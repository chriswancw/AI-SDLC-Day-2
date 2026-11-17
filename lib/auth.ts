import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Session } from './db';
const issuer = 'singapore-todo';
export function signingKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32)
        throw new Error('Set JWT_SECRET to at least 32 random characters');
    return new TextEncoder().encode(secret);
}
export async function verifySession(token: string | undefined): Promise<Session | null> {
    if (!token)
        return null;
    try {
        const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'], issuer, audience: 'session' });
        if (!Number.isSafeInteger(payload.userId) || typeof payload.username !== 'string')
            return null;
        return { userId: payload.userId as number, username: payload.username };
    }
    catch {
        return null;
    }
}
export async function createSession(session: Session) {
    const token = await new SignJWT({ ...session }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setIssuer(issuer).setAudience('session').setExpirationTime('7d').sign(signingKey());
    (await cookies()).set('todo-session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });
}
export async function getSession(): Promise<Session | null> { return verifySession((await cookies()).get('todo-session')?.value); }
export async function deleteSession() { (await cookies()).delete('todo-session'); }
export async function saveChallenge(challenge: string, username: string, operation: 'register' | 'login') {
    const token = await new SignJWT({ challenge, username, operation }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setIssuer(issuer).setAudience('webauthn').setExpirationTime('5m').sign(signingKey());
    (await cookies()).set('todo-challenge', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', maxAge: 300 });
}
export async function consumeChallenge(operation: 'register' | 'login') {
    const jar = await cookies();
    const token = jar.get('todo-challenge')?.value;
    jar.delete({ name: 'todo-challenge', path: '/api/auth' });
    if (!token)
        throw new Error('Challenge expired');
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ['HS256'], issuer, audience: 'webauthn' });
    if (payload.operation !== operation || typeof payload.challenge !== 'string' || typeof payload.username !== 'string')
        throw new Error('Invalid challenge');
    return { challenge: payload.challenge, username: payload.username };
}
