'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
export default function Login() { const router = useRouter(); const [username, setUsername] = useState(''); const [mode, setMode] = useState<'login' | 'register'>('login'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
    const action = mode;
    const res = await fetch(`/api/auth/${action}-options`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const options = await res.json();
    if (!res.ok)
        throw Error(options.error);
    const response = mode === 'register' ? await startRegistration({ optionsJSON: options }) : await startAuthentication({ optionsJSON: options });
    const verified = await fetch(`/api/auth/${action}-verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) });
    const result = await verified.json();
    if (!verified.ok)
        throw Error(result.error);
    router.push('/');
    router.refresh();
}
catch (error) {
    setError(error instanceof Error ? error.message : 'Could not authenticate. Try again.');
}
finally {
    setBusy(false);
} } return <main className="login-shell"><section className="login-story"><Link className="brand" href="/">◒ <span>daylight</span></Link><div><p className="eyebrow">A LITTLE CLARITY, EVERY DAY</p><h1>Make room for<br />what matters.</h1><p>Your tasks, your rhythm. A quieter way to keep life moving.</p></div><p className="small">Thoughtfully organised. Always in Singapore time.</p></section><section className="login-form"><div className="login-card"><span className="brand-mark">◒</span><h2>{mode === 'login' ? 'Welcome back.' : 'Start a little lighter.'}</h2><p className="muted">{mode === 'login' ? 'Pick up where you left off.' : 'Create your personal space with a secure passkey.'}</p><form onSubmit={submit}><label>Username<input autoComplete="username webauthn" required maxLength={80} value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username"/></label><button className="primary full" disabled={busy}>{busy ? 'Waiting for your passkey…' : mode === 'login' ? 'Sign in with passkey' : 'Register with passkey'}</button></form>{error && <p role="alert" className="error">{error}</p>}<p className="small muted">Your device keeps your passkey safe. No password to remember.</p><button className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Already have an account? Sign in'}</button></div></section></main>; }
