import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AccountForms } from '@/components/account-forms';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/account');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, email: true, mustChangePassword: true, dailyDigest: true },
  });
  if (!user) redirect('/login');

  return <AccountForms user={user} />;
}
