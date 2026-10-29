import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { sendDailyDigests } from '@/lib/email/digest';

/** Queue today's morning summaries now (admin tool; also used by the tests). */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const queued = await sendDailyDigests();
  return NextResponse.json({ queued });
}
