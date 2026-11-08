import { NextRequest, NextResponse } from 'next/server';
import { requireSession, badRequest } from '@/lib/api-auth';
import {
  mutateRequest,
  RequestEditSchema,
  RequestError,
  requestErrorResponse,
  requireActivePriority,
} from '@/lib/requests';

type Params = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  const parsed = RequestEditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request edit', parsed.error.issues);
  try {
    const request = await mutateRequest(
      (await params).id,
      guard.session.user,
      async (tx, current) => {
        if (current.createdById !== guard.session.user.id)
          throw new RequestError(403, 'Only the submitter can edit this request');
        if (current.status !== 'New')
          throw new RequestError(409, 'This request is no longer New. Its content cannot be edited.');
        const { updatedAt, occurredAt, ...fields } = parsed.data;
        if (new Date(updatedAt).getTime() !== current.updatedAt.getTime())
          throw new RequestError(
            409,
            'This request changed since you opened it. Reload before editing again.',
          );
        if (fields.categoryId !== current.categoryId) {
          await tx.$queryRaw`SELECT id FROM request_categories WHERE id = ${fields.categoryId}::uuid FOR SHARE`;
          if (!(await tx.requestCategory.findFirst({ where: { id: fields.categoryId, isArchived: false } })))
            throw new RequestError(400, 'Choose an active category');
        }
        if (fields.priorityId !== current.priorityId) await requireActivePriority(tx, fields.priorityId);
        const next = { ...fields, occurredAt: new Date(occurredAt) };
        const changes: Record<string, { from: unknown; to: unknown }> = {};
        for (const key of Object.keys(next) as (keyof typeof next)[]) {
          if (JSON.stringify(current[key]) !== JSON.stringify(next[key]))
            changes[key] = { from: current[key], to: next[key] };
        }
        if (!Object.keys(changes).length) return current;
        await tx.requestActivity.create({
          data: {
            requestId: current.id,
            actorId: guard.session.user.id,
            kind: 'edited',
            body: JSON.stringify(changes),
          },
        });
        return tx.workRequest.update({ where: { id: current.id }, data: next });
      },
      true,
    );
    return NextResponse.json({ request });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
