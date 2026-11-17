import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import db, { type Authenticator, type User } from '@/lib/db';
import { consumeChallenge, createSession, deleteSession, getSession, saveChallenge } from '@/lib/auth';
export const runtime = 'nodejs';
type Context = {
    params: Promise<{
        action: string;
    }>;
};
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const origin = () => process.env.RP_ORIGIN || 'http://localhost:3000';
const rpID = () => process.env.RP_ID || 'localhost';
function ensureChallengeStore() {
    db.exec('CREATE TABLE IF NOT EXISTS webauthn_challenges (challenge TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)');
}
function rememberChallenge(challenge: string) {
    ensureChallengeStore();
    db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO webauthn_challenges(challenge, expires_at) VALUES (?, ?)').run(challenge, Date.now() + 300000);
}
function claimChallenge(challenge: string) {
    ensureChallengeStore();
    const claim = db.prepare('DELETE FROM webauthn_challenges WHERE challenge = ? AND expires_at >= ?').run(challenge, Date.now());
    if (claim.changes !== 1)
        throw new Error('Challenge already used or expired');
}
export async function GET(_request: NextRequest, context: Context) {
    const { action } = await context.params;
    if (action !== 'me')
        return error('Not found', 404);
    const session = await getSession();
    return session ? NextResponse.json(session) : error('Not authenticated', 401);
}
export async function POST(request: NextRequest, context: Context) {
    const { action } = await context.params;
    const suppliedOrigin = request.headers.get('origin');
    if (suppliedOrigin && suppliedOrigin !== origin())
        return error('Invalid origin', 403);
    try {
        if (action === 'logout') {
            await deleteSession();
            return NextResponse.json({ success: true });
        }
        if (action === 'register-options' || action === 'login-options') {
            const body = await request.json();
            const username = typeof body.username === 'string' ? body.username.trim() : '';
            if (!username || username.length > 100)
                return error('Username must contain 1 to 100 characters');
            const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
            if (action === 'register-options') {
                if (user)
                    return error('Username already exists', 409);
                const options = await generateRegistrationOptions({ rpName: process.env.RP_NAME || 'Singapore Todo', rpID: rpID(), userName: username, attestationType: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' } });
                rememberChallenge(options.challenge);
                await saveChallenge(options.challenge, username, 'register');
                return NextResponse.json(options);
            }
            if (!user)
                return error('Account not found', 404);
            const authenticators = db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(user.id) as Authenticator[];
            const options = await generateAuthenticationOptions({ rpID: rpID(), userVerification: 'required', allowCredentials: authenticators.map(auth => ({ id: auth.credential_id })) });
            rememberChallenge(options.challenge);
            await saveChallenge(options.challenge, username, 'login');
            return NextResponse.json(options);
        }
        if (action === 'register-verify') {
            const challenge = await consumeChallenge('register');
            claimChallenge(challenge.challenge);
            const { response } = await request.json() as {
                response: RegistrationResponseJSON;
            };
            const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: origin(), expectedRPID: rpID(), requireUserVerification: true });
            if (!verification.verified)
                return error('Passkey verification failed', 401);
            const credential = verification.registrationInfo.credential;
            const userId = db.transaction(() => {
                if (db.prepare('SELECT id FROM users WHERE username = ?').get(challenge.username))
                    throw new Error('Username already exists');
                const userId = Number(db.prepare('INSERT INTO users(username) VALUES (?)').run(challenge.username).lastInsertRowid);
                const credentialID = isoBase64URL.fromBuffer(isoBase64URL.toBuffer(credential.id));
                db.prepare('INSERT INTO authenticators(user_id, credential_id, credential_public_key, counter) VALUES (?, ?, ?, ?)').run(userId, credentialID, Buffer.from(credential.publicKey), credential.counter ?? 0);
                return userId;
            })();
            const session = { userId, username: challenge.username };
            await createSession(session);
            return NextResponse.json(session, { status: 201 });
        }
        if (action === 'login-verify') {
            const challenge = await consumeChallenge('login');
            claimChallenge(challenge.challenge);
            const { response } = await request.json() as {
                response: AuthenticationResponseJSON;
            };
            const user = db.prepare('SELECT * FROM users WHERE username = ?').get(challenge.username) as User | undefined;
            if (!user || !response || typeof response.id !== 'string')
                return error('Passkey verification failed', 401);
            const auth = db.prepare('SELECT * FROM authenticators WHERE user_id = ? AND credential_id = ?').get(user.id, response.id) as Authenticator | undefined;
            if (!auth)
                return error('Passkey not found', 401);
            const storedCounter = auth.counter ?? 0;
            const verification = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: origin(), expectedRPID: rpID(), credential: { id: auth.credential_id, publicKey: new Uint8Array(auth.credential_public_key), counter: storedCounter }, requireUserVerification: true });
            const nextCounter = verification.authenticationInfo.newCounter;
            if (!verification.verified || ((storedCounter !== 0 || nextCounter !== 0) && nextCounter <= storedCounter))
                return error('Passkey counter regression detected', 401);
            const update = db.prepare('UPDATE authenticators SET counter = ? WHERE id = ? AND counter = ?').run(nextCounter, auth.id, storedCounter);
            if (update.changes !== 1)
                return error('Passkey changed during verification. Try again.', 409);
            const session = { userId: user.id, username: user.username };
            await createSession(session);
            return NextResponse.json(session);
        }
        return error('Not found', 404);
    }
    catch {
        return error('Authentication failed. Please retry with your passkey.', 400);
    }
}
