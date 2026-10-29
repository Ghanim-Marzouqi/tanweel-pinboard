import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from '@/lib/validation';

export { TASK_PRIORITIES, TASK_STATUSES };

/** Translation key under `tasks.status`. */
export const STATUS_KEY: Record<TaskStatus, string> = {
  Todo: 'todo',
  InProgress: 'inProgress',
  InReview: 'inReview',
  Done: 'done',
};

/** Translation key under `tasks.priority`. */
export const PRIORITY_KEY: Record<TaskPriority, string> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Urgent: 'urgent',
};
