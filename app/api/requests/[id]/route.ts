import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireAdmin, notFound, badRequest } from '@/lib/api-auth';
import { findVisibleRequest, mutateRequest, RequestReviewSchema, requestErrorResponse } from '@/lib/requests';
type Params = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const request = await findVisibleRequest((await params).id, guard.session.user);
  return request ? NextResponse.json({ request }) : notFound('Request not found');
}
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = RequestReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid review; closing requires a reason');
  try {
    const request = await mutateRequest(
      (await params).id,
      guard.session.user,
      async (tx, current) => {
        const closureReason = parsed.data.status === 'Closed' ? parsed.data.closureReason : '';
        if (current.status === parsed.data.status && current.closureReason === closureReason) return current;
        await tx.requestActivity.create({
          data: {
            requestId: current.id,
            actorId: guard.session.user.id,
            kind: 'status',
            body: JSON.stringify({ from: current.status, to: parsed.data.status, reason: closureReason }),
          },
        });
        return tx.workRequest.update({
          where: { id: current.id },
          data: { status: parsed.data.status, closureReason },
        });
      },
      true,
    );
    return NextResponse.json({ request });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
