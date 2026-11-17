import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Daylight · Your everyday, in order', description: 'A calm space for your tasks, plans and small wins.' };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="en"><body>{children}</body></html>; }
