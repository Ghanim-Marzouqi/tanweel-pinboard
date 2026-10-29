import type { DefaultSession } from 'next-auth';
import type { Role } from '@/lib/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      role: Role;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    userId?: string;
    username?: string;
    role?: Role;
    sessionVersion?: number;
    mustChangePassword?: boolean;
    /** Absolute expiry (ms) for sessions without "Stay signed in". */
    expiresAt?: number;
    checkedAt?: number;
  }
}
