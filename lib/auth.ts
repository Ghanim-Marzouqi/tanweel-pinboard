import NextAuth, { type User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { burnPasswordCheck, verifyPassword } from '@/lib/password';
import { loginLimiter } from '@/lib/rate-limit';
import { LoginSchema } from '@/lib/validation';
import type { Role } from '@/lib/roles';

// How often a signed-in session re-reads the user row, so deactivating a user
// or changing their role takes effect without waiting for the session to expire.
const REVALIDATE_MS = 60 * 1000;

interface AuthorizedUser extends User {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'Pinboard',
      credentials: {
        identifier: { label: 'Username or email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<AuthorizedUser | null> {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;

        if (loginLimiter.isBlocked(identifier)) return null;

        const user = await prisma.user.findFirst({
          where: identifier.includes('@')
            ? { email: identifier }
            : { username: identifier },
        });

        if (!user) {
          await burnPasswordCheck(password);
          loginLimiter.recordFailure(identifier);
          return null;
        }
        if (!user.isActive || !(await verifyPassword(user.passwordHash, password))) {
          loginLimiter.recordFailure(identifier);
          return null;
        }

        loginLimiter.reset(identifier);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthorizedUser;
        token.userId = u.id;
        token.username = u.username;
        token.name = u.name;
        token.role = u.role;
        token.checkedAt = Date.now();
        return token;
      }

      if (!token.userId) return null;
      if (Date.now() - (token.checkedAt ?? 0) < REVALIDATE_MS) return token;

      const current = await prisma.user.findUnique({
        where: { id: token.userId },
        select: { username: true, name: true, role: true, isActive: true },
      });
      if (!current?.isActive) return null;

      token.username = current.username;
      token.name = current.name;
      token.role = current.role;
      token.checkedAt = Date.now();
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId ?? '';
      session.user.username = token.username ?? '';
      session.user.name = token.name ?? session.user.username;
      session.user.role = token.role ?? 'member';
      return session;
    },
  },
});
