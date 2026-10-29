import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin, badRequest, notFound } from '@/lib/api-auth';
import { CategorySchema, requestErrorResponse } from '@/lib/requests';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !(await prisma.requestCategory.findUnique({ where: { id } })))
    return notFound('Category not found');
  const parsed = CategorySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('English and Arabic names are required');
  try {
    return NextResponse.json({
      category: await prisma.requestCategory.update({ where: { id }, data: parsed.data }),
    });
  } catch (e) {
    return requestErrorResponse(e);
  }
}
