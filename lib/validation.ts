import { z } from 'zod';

export const TaskStatusEnum = z.enum(['Open', 'InProgress', 'Resolved', 'Closed']);

export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TaskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  descriptionHtml: z.string().max(50_000).default(''),
  status: TaskStatusEnum.default('Open'),
});

export const TaskUpdateSchema = TaskCreateSchema.partial();

export const CommentCreateSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const CommentUpdateSchema = CommentCreateSchema;

export const TaskListQuerySchema = z.object({
  status: TaskStatusEnum.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

/** Sign-in accepts either the username or the email address. */
export const LoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(1024),
});

export const ALLOWED_UPLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/plain',
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
