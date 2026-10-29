import { NextRequest, NextResponse } from 'next/server';
import { requireSession, badRequest } from '@/lib/api-auth';
import { CommentCreateSchema } from '@/lib/validation';
import { mutateRequest, requestErrorResponse } from '@/lib/requests';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const parsed = CommentCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid comment');
  try {
    const comment = await mutateRequest((await params).id, guard.session.user, (tx, r) =>
      tx.requestActivity.create({
        data: { requestId: r.id, actorId: guard.session.user.id, kind: 'comment', body: parsed.data.body },
      }),
    );
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
