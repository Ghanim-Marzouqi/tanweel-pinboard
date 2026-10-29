import Image from 'next/image';
import { cx } from '@/lib/utils';

/** Official, unmodified Tanweel wordmark, with its original proportions. */
export function BrandMark({
  size = 32,
  variant = 'purple',
  className,
}: {
  size?: number;
  variant?: 'purple' | 'white';
  className?: string;
}) {
  return (
    <Image
      src={`/brand/tanweel-${variant}.png`}
      alt="Tanweel"
      width={776}
      height={240}
      unoptimized
      className={cx('block shrink-0 object-contain', className)}
      style={{ width: (size * 776) / 240, height: size }}
    />
  );
}
