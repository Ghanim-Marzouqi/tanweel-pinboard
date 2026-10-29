import { TASK_STATUSES, type TaskStatus } from '@/lib/validation';

export { TASK_STATUSES };

/** Translation key under `tasks.status`. */
export const STATUS_KEY: Record<TaskStatus, string> = {
  Todo: 'todo',
  InProgress: 'inProgress',
  InReview: 'inReview',
  Done: 'done',
};
