import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findVisibleRequest } from '@/lib/requests';
import { projectPeople } from '@/lib/tasks';
import { RequestDetail, type RequestView } from '@/components/request-detail';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const request = await findVisibleRequest((await params).id, session.user);
  if (!request) notFound();
  const isAdmin = session.user.role === 'admin';
  const [people, tasks] = isAdmin
    ? await Promise.all([
        projectPeople(request.projectId),
        prisma.task.findMany({
          where: { projectId: request.projectId },
          select: { id: true, title: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
      ])
    : [[], []];
  const key = [
    request.id,
    request.updatedAt.toISOString(),
    request.activities.length,
    request.attachments.length,
    request.taskLinks.length,
  ].join(':');
  return (
    <RequestDetail
      key={key}
      request={JSON.parse(JSON.stringify(request)) as RequestView}
      isAdmin={isAdmin}
      userId={session.user.id}
      people={people}
      initialTasks={tasks}
    />
  );
}
