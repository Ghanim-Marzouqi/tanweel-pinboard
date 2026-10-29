import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/access';
import { PUBLIC_USER_SELECT } from '@/lib/users';
import { UsersAdmin } from '@/components/users-admin';

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/admin/users');
  if (!isAdmin(session.user)) redirect('/');

  const users = await prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  return (
    <UsersAdmin
      currentUserId={session.user.id}
      users={users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
