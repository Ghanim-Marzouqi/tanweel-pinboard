import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin, badRequest } from '@/lib/api-auth';
import { PrioritySchema, requestErrorResponse } from '@/lib/requests';
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  return NextResponse.json({
    priorities: await prisma.requestPriority.findMany({
      where: guard.session.user.role === 'admin' ? {} : { isArchived: false },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  });
}
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = PrioritySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('English and Arabic names are required');
  try {
    return NextResponse.json(
      { priority: await prisma.requestPriority.create({ data: parsed.data }) },
      { status: 201 },
    );
  } catch (e) {
    return requestErrorResponse(e);
  }
}
