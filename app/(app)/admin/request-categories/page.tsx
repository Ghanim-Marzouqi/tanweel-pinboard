import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RequestCategories } from '@/components/request-categories';
export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'admin') redirect('/requests');
  const categories = await prisma.requestCategory.findMany({ orderBy: { nameEn: 'asc' } });
  return <RequestCategories categories={categories} />;
}
