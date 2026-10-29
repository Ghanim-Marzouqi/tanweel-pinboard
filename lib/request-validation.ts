import { z } from 'zod';
import { TaskFormSchema } from '@/lib/validation';

export const REQUEST_STATUSES = ['New', 'UnderReview', 'Accepted', 'Closed'] as const;
export const RequestCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20_000),
  suggestions: z.string().trim().max(10_000).default(''),
  shift: z.string().trim().max(120).default(''),
  occurredAt: z.iso.datetime({ offset: true }),
  categoryId: z.uuid(),
});
export const RequestReviewSchema = z
  .object({
    status: z.enum(REQUEST_STATUSES),
    closureReason: z.string().trim().max(2_000).default(''),
  })
  .refine((v) => v.status !== 'Closed' || v.closureReason.length > 0, {
    path: ['closureReason'],
    message: 'A reason is required to close a request',
  });
export const CategorySchema = z.object({
  nameEn: z.string().trim().min(1).max(80),
  nameAr: z.string().trim().min(1).max(80),
  isArchived: z.boolean().default(false),
});
export const RequestLinkSchema = z.union([
  z.object({ taskId: z.uuid() }).strict(),
  z.object({ creationKey: z.uuid(), task: TaskFormSchema }).strict(),
]);
export const RequestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(200).default(''),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(REQUEST_STATUSES).optional()),
  categoryId: z.preprocess((v) => (v === '' ? undefined : v), z.uuid().optional()),
});
export function muscatDateTimeInput(date = new Date()): string {
  return new Date(date.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
