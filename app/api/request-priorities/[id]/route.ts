import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, badRequest, notFound } from '@/lib/api-auth';
import { PrioritySchema, requestErrorResponse } from '@/lib/requests';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !(await prisma.requestPriority.findUnique({ where: { id } })))
    return notFound('Priority not found');
  const parsed = PrioritySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('English and Arabic names are required');
  try {
    return NextResponse.json({
      priority: await prisma.requestPriority.update({ where: { id }, data: parsed.data }),
    });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
