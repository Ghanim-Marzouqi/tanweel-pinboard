import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import { ROLES } from '@/lib/roles';

export const TASK_STATUSES = ['Todo', 'InProgress', 'InReview', 'Done'] as const;
export const TaskStatusEnum = z.enum(TASK_STATUSES);

export type TaskStatus = z.infer<typeof TaskStatusEnum>;

// --- Tasks ---------------------------------------------------------------

const taskFields = {
  title: z.string().trim().min(1).max(200),
  descriptionHtml: z.string().max(50_000).default(''),
  status: TaskStatusEnum.default('Todo'),
};

/** Task fields from the form; the project comes from the URL. */
export const TaskFormSchema = z.object(taskFields);

export const TaskUpdateSchema = TaskFormSchema.partial();

export const CommentCreateSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const CommentUpdateSchema = CommentCreateSchema;

export const TaskListQuerySchema = z.object({
  status: TaskStatusEnum.optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

// --- Projects ------------------------------------------------------------

export const ProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).default(''),
});

export const ProjectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000),
    isArchived: z.boolean(),
  })
  .partial();

export const ProjectMemberAddSchema = z.object({
  userId: z.uuid(),
});

// --- Users & accounts ----------------------------------------------------

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

const username = z.string().trim().toLowerCase().regex(USERNAME_PATTERN);
const displayName = z.string().trim().min(1).max(120);
/** Optional email: blank input means "no email". */
const optionalEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.email().trim().toLowerCase().max(254).nullable(),
);
const newPassword = z.string().min(MIN_PASSWORD_LENGTH).max(1024);

export const UserCreateSchema = z.object({
  username,
  name: displayName,
  email: optionalEmail.default(null),
  role: z.enum(ROLES).default('member'),
  /** Temporary password; the user must change it at first sign-in. */
  password: newPassword,
});

export const UserUpdateSchema = z
  .object({
    name: displayName,
    email: optionalEmail,
    role: z.enum(ROLES),
    isActive: z.boolean(),
  })
  .partial();

export const PasswordResetSchema = z.object({
  password: newPassword,
});

export const AccountUpdateSchema = z.object({
  name: displayName,
  email: optionalEmail,
});

export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    newPassword,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'same_as_current',
  });

/** Sign-in accepts either the username or the email address. */
export const LoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(1024),
  /** Form values arrive as strings. */
  remember: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(false),
});

// --- Attachments ---------------------------------------------------------

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
