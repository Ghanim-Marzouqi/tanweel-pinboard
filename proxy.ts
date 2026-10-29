import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Reachable while the user still has a temporary password.
const PASSWORD_CHANGE_PATHS = ['/account', '/api/account/password'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // Public paths
  if (
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/password-reset/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname === '/apple-icon.png' ||
    pathname === '/brand/tanweel-purple.png' ||
    pathname === '/brand/tanweel-white.png'
  ) {
    return NextResponse.next();
  }

  const user = req.auth?.user;
  if (!user?.id) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  if (user.mustChangePassword && !PASSWORD_CHANGE_PATHS.includes(pathname)) {
    if (isApi) {
      return NextResponse.json({ error: 'Password change required' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/account', req.url));
  }

  // Page-level guard only; admin API routes check the role themselves.
  if (pathname.startsWith('/admin') && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
