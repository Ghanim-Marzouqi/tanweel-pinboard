import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { TaskForm } from '@/components/task-form';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import type { TaskStatus } from '@/lib/validation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTaskPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      attachments: { orderBy: { uploadedAt: 'asc' } },
    },
  });
  if (!task) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <TaskForm
          mode="edit"
          canDelete={task.createdById === session.user.id || session.user.role === 'admin'}
          initial={{
            id: task.id,
            title: task.title,
            descriptionHtml: task.descriptionHtml,
            status: task.status as TaskStatus,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
            createdByName: task.createdBy.name,
            attachments: task.attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              contentType: a.contentType,
              sizeBytes: a.sizeBytes,
              uploadedAt: a.uploadedAt.toISOString(),
            })),
          }}
        />
      </main>
    </>
  );
}
