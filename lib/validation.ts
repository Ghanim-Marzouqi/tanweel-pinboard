import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import { ROLES } from '@/lib/roles';

export const TASK_STATUSES = ['Todo', 'InProgress', 'InReview', 'Done'] as const;
export const TaskStatusEnum = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

/** Lowest to highest — also the database sort order. */
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const TaskPriorityEnum = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

/** An empty form value means "none". (Missing stays missing, so partial updates don't clear it.) */
const blankToNull = (v: unknown) => (v === '' ? null : v);

// --- Tasks ---------------------------------------------------------------

/** Task fields without defaults (shared by create and partial update). */
const taskFieldSchemas = {
  title: z.string().trim().min(1).max(200),
  descriptionHtml: z.string().max(50_000),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  /** Calendar date "YYYY-MM-DD" or null. */
  dueDate: z.preprocess(blankToNull, z.iso.date().nullable()),
  assigneeId: z.preprocess(blankToNull, z.uuid().nullable()),
};

/** Task fields from the form; the project comes from the URL. */
export const TaskFormSchema = z.object({
  ...taskFieldSchemas,
  descriptionHtml: taskFieldSchemas.descriptionHtml.default(''),
  status: taskFieldSchemas.status.default('Todo'),
  priority: taskFieldSchemas.priority.default('Medium'),
  dueDate: taskFieldSchemas.dueDate.default(null),
  assigneeId: taskFieldSchemas.assigneeId.default(null),
});

/**
 * Partial update: only the fields sent are changed (no defaults here, Zod 4
 * would apply them to missing keys). `projectId` moves the task.
 */
export const TaskUpdateSchema = z
  .object({ ...taskFieldSchemas, projectId: z.uuid() })
  .partial();

export const CommentCreateSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const CommentUpdateSchema = CommentCreateSchema;

export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export const TASK_SORTS = ['newest', 'due', 'priority'] as const;

/** Filters for a project's task list/board (from the URL). */
export const TaskListQuerySchema = z.object({
  view: z.enum(['list', 'board']).default('list'),
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  /** "me", "none" (unassigned) or a user id. */
  assignee: z.union([z.enum(['me', 'none']), z.uuid()]).optional(),
  due: z.enum(DUE_FILTERS).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(TASK_SORTS).default('newest'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;

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
