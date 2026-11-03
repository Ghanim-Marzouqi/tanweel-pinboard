import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireAdmin, notFound, badRequest } from '@/lib/api-auth';
import {
  findVisibleRequest,
  mutateRequest,
  RequestReviewSchema,
  requestErrorResponse,
  RequestError,
  requireActivePriority,
} from '@/lib/requests';
import { removeFolder } from '@/lib/storage';
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
        const priorityId = parsed.data.priorityId === undefined ? current.priorityId : parsed.data.priorityId;
        if (priorityId !== current.priorityId) {
          await requireActivePriority(tx, priorityId);
          const priority = priorityId
            ? await tx.requestPriority.findUniqueOrThrow({ where: { id: priorityId } })
            : null;
          await tx.requestActivity.create({
            data: {
              requestId: current.id,
              actorId: guard.session.user.id,
              kind: 'priority',
              body: JSON.stringify({ from: current.priority, to: priority }),
            },
          });
        }
        if (current.status !== parsed.data.status || current.closureReason !== closureReason) {
          await tx.requestActivity.create({
            data: {
              requestId: current.id,
              actorId: guard.session.user.id,
              kind: 'status',
              body: JSON.stringify({ from: current.status, to: parsed.data.status, reason: closureReason }),
            },
          });
        }
        return tx.workRequest.update({
          where: { id: current.id },
          data: { status: parsed.data.status, closureReason, priorityId },
        });
      },
      true,
    );
    return NextResponse.json({ request });
  } catch (e) {
    return requestErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    // Link, upload, comment and review mutations acquire the same row lock.
    await mutateRequest(
      id,
      guard.session.user,
      async (tx, current) => {
        if (current.taskLinks.length)
          throw new RequestError(409, 'Unlink all tasks before deleting this request');
        await tx.workRequest.delete({ where: { id: current.id } });
      },
      true,
    );
  } catch (e) {
    return requestErrorResponse(e);
  }
  // The database commit comes first; a disk failure must not resurrect the request.
  await removeFolder(`requests/${id}/`).catch(() => {
    console.error('Request attachment cleanup failed', { requestId: id });
  });
  return NextResponse.json({ ok: true });
}
