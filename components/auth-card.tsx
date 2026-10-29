import { BrandMark } from '@/components/brand-mark';
import { LocaleToggle } from '@/components/locale-toggle';

/** Centered card for the signed-out pages (forgot / reset password). */
export function AuthCard({ brand, children }: { brand: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex flex-col items-start gap-2">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight">{brand}</span>
          </div>
          <LocaleToggle compact />
        </div>
        {children}
      </div>
    </div>
  );
}
