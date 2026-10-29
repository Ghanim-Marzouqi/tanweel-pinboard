'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { MessageSquare, Paperclip } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { AssigneeName, ChecklistProgress, DueDate, PriorityBadge } from '@/components/task-meta';
import { useToast } from '@/components/toast';
import { sendJson } from '@/lib/client-api';
import { STATUS_KEY, TASK_STATUSES } from '@/lib/status';
import type { TaskSummary } from '@/lib/tasks';
import { cx } from '@/lib/utils';
import type { TaskStatus } from '@/lib/validation';

interface Props {
  tasks: TaskSummary[];
  /** False for archived projects: cards can't be dragged. */
  canEdit: boolean;
}

/**
 * Kanban board: one column per status. Dragging a card to another column
 * changes its status (optimistically; reverted if the save fails).
 */
export function TaskBoard({ tasks: initialTasks, canEdit }: Props) {
  const t = useTranslations('tasks');
  const toast = useToast();
  const [tasks, setTasks] = useState(initialTasks);

  async function moveTask(taskId: string, status: TaskStatus) {
    const previous = tasks.find((x) => x.id === taskId)?.status;
    if (!previous || previous === status) return;
    setTasks((list) => list.map((x) => (x.id === taskId ? { ...x, status } : x)));
    const res = await sendJson(`/api/tasks/${taskId}`, 'PUT', { status });
    if (!res.ok) {
      setTasks((list) => list.map((x) => (x.id === taskId ? { ...x, status: previous } : x)));
      toast.error(t('board.moveFailed'), { description: res.error });
    }
  }

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const taskId = event.operation.source?.id;
        const status = event.operation.target?.id;
        if (typeof taskId === 'string' && typeof status === 'string') {
          void moveTask(taskId, status as TaskStatus);
        }
      }}
    >
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((x) => x.status === status)}
            canEdit={canEdit}
            label={t(`status.${STATUS_KEY[status]}`)}
            emptyLabel={t('board.empty')}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}

function Column({
  status,
  tasks,
  canEdit,
  label,
  emptyLabel,
}: {
  status: TaskStatus;
  tasks: TaskSummary[];
  canEdit: boolean;
  label: string;
  emptyLabel: string;
}) {
  const { ref, isDropTarget } = useDroppable({ id: status, disabled: !canEdit });
  return (
    <section
      ref={ref}
      aria-label={label}
      data-status={status}
      className={cx(
        'flex w-72 shrink-0 snap-start flex-col rounded-xl border p-2 transition-colors lg:w-auto',
        isDropTarget
          ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
          : 'border-[color:var(--border)] bg-[color:var(--surface-muted)]',
      )}
    >
      <header className="flex items-center justify-between px-1 pb-2 pt-1">
        <StatusBadge status={status} />
        <span className="text-xs font-medium text-[color:var(--text-muted)]">{tasks.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[color:var(--text-faint)]">{emptyLabel}</p>
        ) : (
          tasks.map((task) => <Card key={task.id} task={task} canEdit={canEdit} />)
        )}
      </div>
    </section>
  );
}

function Card({ task, canEdit }: { task: TaskSummary; canEdit: boolean }) {
  const { ref, isDragging } = useDraggable({ id: task.id, disabled: !canEdit });
  return (
    <article
      ref={ref}
      data-task-id={task.id}
      className={cx(
        'rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-sm)]',
        canEdit && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-60 ring-2 ring-[color:var(--accent-ring)]',
      )}
    >
      <Link
        href={`/tasks/${task.id}`}
        className="block text-sm font-medium leading-snug text-[color:var(--text)] hover:text-[color:var(--accent)]"
      >
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PriorityBadge priority={task.priority} />
        <DueDate dueDate={task.dueDate} status={task.status} />
        <ChecklistProgress done={task.checklistDone} total={task.checklistTotal} />
        {task.attachments > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-faint)]">
            <Paperclip size={12} />
            {task.attachments}
          </span>
        )}
        {task.comments > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-faint)]">
            <MessageSquare size={12} />
            {task.comments}
          </span>
        )}
      </div>
      <div className="mt-2">
        <AssigneeName assignee={task.assignee} />
      </div>
    </article>
  );
}
