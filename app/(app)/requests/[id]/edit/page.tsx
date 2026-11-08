import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findVisibleRequest } from '@/lib/requests';
import { RequestCreate } from '@/components/request-create';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const request = await findVisibleRequest((await params).id, session.user);
  if (!request || request.createdById !== session.user.id) notFound();
  if (request.status !== 'New' || request.project.isArchived) redirect(`/requests/${request.id}`);
  const [categories, priorities] = await Promise.all([
    prisma.requestCategory.findMany({
      where: { OR: [{ isArchived: false }, { id: request.categoryId }] },
      orderBy: { nameEn: 'asc' },
    }),
    prisma.requestPriority.findMany({
      where: { OR: [{ isArchived: false }, ...(request.priorityId ? [{ id: request.priorityId }] : [])] },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    }),
  ]);
  return (
    <RequestCreate
      project={request.project}
      categories={categories}
      priorities={priorities}
      reporter={request.createdBy.name}
      now={request.occurredAt.toISOString()}
      edit={{
        id: request.id,
        title: request.title,
        description: request.description,
        suggestions: request.suggestions,
        shift: request.shift,
        categoryId: request.categoryId,
        priorityId: request.priorityId,
        updatedAt: request.updatedAt.toISOString(),
      }}
    />
  );
}
