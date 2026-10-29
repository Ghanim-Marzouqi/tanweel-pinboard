import { prisma } from '@/lib/prisma';

/** Fields of a user that are safe to send to the browser. */
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Number of active admins other than `exceptUserId`. */
export function countOtherActiveAdmins(exceptUserId: string): Promise<number> {
  return prisma.user.count({
    where: { role: 'admin', isActive: true, id: { not: exceptUserId } },
  });
}
