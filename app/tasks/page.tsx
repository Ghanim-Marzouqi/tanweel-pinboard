import { Header } from '@/components/header';
import { TaskListClient } from '@/components/task-list';
import { prisma } from '@/lib/prisma';
import { TaskListQuerySchema, type TaskStatus } from '@/lib/validation';
import { taskListWhere } from '@/lib/tasks';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TasksPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/tasks');

  const raw = await searchParams;
  const parsed = TaskListQuerySchema.safeParse({
    status: typeof raw.status === 'string' ? raw.status : undefined,
    q: typeof raw.q === 'string' ? raw.q : undefined,
  });
  const filters = parsed.success ? parsed.data : {};

  const tasks = await prisma.task.findMany({
    where: taskListWhere(filters),
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { attachments: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <TaskListClient
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status as TaskStatus,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
            createdByName: t.createdBy.name,
            attachmentsCount: t._count.attachments,
            commentsCount: t._count.comments,
          }))}
          initialFilters={{
            status: filters.status,
            q: filters.q ?? '',
          }}
        />
      </main>
    </>
  );
}
