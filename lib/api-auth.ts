import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';

export async function requireSession(): Promise<
  | { ok: true; session: Session & { user: NonNullable<Session['user']> } }
  | { ok: false; response: NextResponse }
> {
  const session = (await auth()) as Session | null;
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return {
    ok: true,
    session: session as Session & { user: NonNullable<Session['user']> },
  };
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function isAdmin(session: Session): boolean {
  return session.user?.role === 'admin';
}
