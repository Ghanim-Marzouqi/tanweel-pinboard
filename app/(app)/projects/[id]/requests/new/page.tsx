import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleProjectsWhere } from '@/lib/access';
import { RequestCreate } from '@/components/request-create';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const project = await prisma.project.findFirst({
    where: { id: (await params).id, ...visibleProjectsWhere(session.user) },
    select: { id: true, name: true, isArchived: true },
  });
  if (!project) notFound();
  if (project.isArchived) redirect(`/projects/${project.id}/requests`);
  const categories = await prisma.requestCategory.findMany({
    where: { isArchived: false },
    orderBy: { nameEn: 'asc' },
  });
  return (
    <RequestCreate
      project={project}
      categories={categories}
      reporter={session.user.name}
      now={new Date().toISOString()}
    />
  );
}
