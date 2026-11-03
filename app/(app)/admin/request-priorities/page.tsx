import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RequestOptions } from '@/components/request-options';
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'admin') redirect('/requests');
  const priorities = await prisma.requestPriority.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  return <RequestOptions kind="priorities" entries={priorities} />;
}
