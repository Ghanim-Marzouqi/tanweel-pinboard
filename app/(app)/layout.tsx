import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleProjectsWhere } from '@/lib/access';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { user } = session;

  const projects = user.mustChangePassword
    ? []
    : await prisma.project.findMany({
        where: { ...visibleProjectsWhere(user), isArchived: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

  return (
    <AppShell
      user={{ name: user.name, username: user.username, role: user.role }}
      projects={projects}
      minimal={user.mustChangePassword}
    >
      {children}
    </AppShell>
  );
}
