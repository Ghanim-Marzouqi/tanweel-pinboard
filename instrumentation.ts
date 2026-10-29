/** Runs once when the Next.js server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.EMAIL_WORKER !== 'off') {
    const { startEmailWorker } = await import('@/lib/email/worker');
    startEmailWorker();
  }
}
