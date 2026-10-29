import { Header } from '@/components/header';
import { TaskForm } from '@/components/task-form';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function NewTaskPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/tasks/new');

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <TaskForm mode="create" />
      </main>
    </>
  );
}
