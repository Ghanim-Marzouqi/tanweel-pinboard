import { describe, expect, it } from 'vitest';
import { taskFilterWhere, taskOrderBy } from '@/lib/tasks';

const ctx = { userId: 'user-1', today: '2026-10-29' };
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('taskFilterWhere', () => {
  it('is empty without filters', () => {
    expect(taskFilterWhere({}, ctx)).toEqual({});
  });

  it('maps assignee shortcuts', () => {
    expect(taskFilterWhere({ assignee: 'me' }, ctx)).toEqual({ AND: [{ assigneeId: 'user-1' }] });
    expect(taskFilterWhere({ assignee: 'none' }, ctx)).toEqual({ AND: [{ assigneeId: null }] });
  });

  it('treats overdue as before today and not done', () => {
    expect(taskFilterWhere({ due: 'overdue' }, ctx)).toEqual({
      AND: [{ dueDate: { lt: day('2026-10-29') }, status: { not: 'Done' } }],
    });
  });

  it('limits "this week" to today through Saturday', () => {
    expect(taskFilterWhere({ due: 'week' }, ctx)).toEqual({
      AND: [{ dueDate: { gte: day('2026-10-29'), lte: day('2026-10-31') } }],
    });
  });

  it('searches the title and the description text', () => {
    const where = taskFilterWhere({ q: 'invoice' }, ctx);
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: 'invoice', mode: 'insensitive' } },
            { descriptionText: { contains: 'invoice', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('combines filters', () => {
    const where = taskFilterWhere({ status: 'Todo', priority: 'High' }, ctx);
    expect(where).toEqual({ AND: [{ status: 'Todo' }, { priority: 'High' }] });
  });
});

describe('taskOrderBy', () => {
  it('puts tasks without a due date last when sorting by due date', () => {
    expect(taskOrderBy('due')[0]).toEqual({ dueDate: { sort: 'asc', nulls: 'last' } });
  });

  it('sorts urgent first when sorting by priority', () => {
    expect(taskOrderBy('priority')[0]).toEqual({ priority: 'desc' });
  });
});
