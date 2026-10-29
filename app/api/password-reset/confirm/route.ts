import { NextRequest, NextResponse } from 'next/server';
import { badRequest } from '@/lib/api-auth';
import { resetPasswordWithToken } from '@/lib/password-reset';
import { PasswordResetConfirmSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = PasswordResetConfirmSchema.safeParse(json);
  if (!parsed.success) return badRequest('Invalid body', parsed.error.issues);

  const ok = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!ok) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 410 });
  return NextResponse.json({ ok: true });
}
