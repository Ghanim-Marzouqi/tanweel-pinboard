import { describe, expect, it } from 'vitest';
import {
  LoginSchema,
  PasswordChangeSchema,
  ProjectCreateSchema,
  TaskFormSchema,
  TaskListQuerySchema,
  TaskUpdateSchema,
  UserCreateSchema,
  UserUpdateSchema,
} from '@/lib/validation';

describe('LoginSchema', () => {
  it('trims and lower-cases the identifier', () => {
    const parsed = LoginSchema.parse({ identifier: '  Ali@Tanweel.OM ', password: 'x' });
    expect(parsed.identifier).toBe('ali@tanweel.om');
  });

  it('rejects an empty password', () => {
    expect(LoginSchema.safeParse({ identifier: 'ali', password: '' }).success).toBe(false);
  });

  it('reads "Stay signed in" from the form string', () => {
    expect(LoginSchema.parse({ identifier: 'a', password: 'x', remember: 'true' }).remember).toBe(true);
    expect(LoginSchema.parse({ identifier: 'a', password: 'x', remember: 'false' }).remember).toBe(false);
    expect(LoginSchema.parse({ identifier: 'a', password: 'x' }).remember).toBe(false);
  });
});

describe('TaskFormSchema', () => {
  it('fills in defaults', () => {
    expect(TaskFormSchema.parse({ title: 'Fix invoice' })).toEqual({
      title: 'Fix invoice',
      descriptionHtml: '',
      status: 'Todo',
      priority: 'Medium',
      dueDate: null,
      assigneeId: null,
    });
  });

  it('treats blank due date and assignee as none', () => {
    const parsed = TaskFormSchema.parse({ title: 'x', dueDate: '', assigneeId: '' });
    expect(parsed.dueDate).toBeNull();
    expect(parsed.assigneeId).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(TaskFormSchema.safeParse({ title: 'x', dueDate: '2026-02-30' }).success).toBe(false);
  });

  it('rejects a blank title', () => {
    expect(TaskFormSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('TaskUpdateSchema', () => {
  it('only contains the fields that were sent', () => {
    // A board drag sends just the status; nothing else may be reset.
    expect(TaskUpdateSchema.parse({ status: 'Done' })).toEqual({ status: 'Done' });
  });

  it('clears the due date when sent blank', () => {
    expect(TaskUpdateSchema.parse({ dueDate: '' })).toEqual({ dueDate: null });
  });
});

describe('TaskListQuerySchema', () => {
  it('defaults to the first page of the list, newest first', () => {
    expect(TaskListQuerySchema.parse({})).toEqual({ view: 'list', sort: 'newest', page: 1 });
  });


  it('accepts the four statuses only', () => {
    for (const status of ['Todo', 'InProgress', 'InReview', 'Done']) {
      expect(TaskListQuerySchema.safeParse({ status }).success).toBe(true);
    }
    expect(TaskListQuerySchema.safeParse({ status: 'Open' }).success).toBe(false);
  });
});

describe('ProjectCreateSchema', () => {
  it('requires a name and defaults the description', () => {
    expect(ProjectCreateSchema.parse({ name: ' Website ' })).toEqual({ name: 'Website', description: '' });
    expect(ProjectCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('UserCreateSchema', () => {
  const valid = { username: 'Sara.B', name: 'Sara', password: 'temporary1' };

  it('normalises the username and treats a blank email as none', () => {
    const parsed = UserCreateSchema.parse({ ...valid, email: '  ' });
    expect(parsed.username).toBe('sara.b');
    expect(parsed.email).toBeNull();
    expect(parsed.role).toBe('member');
  });

  it('rejects usernames with spaces or that are too short', () => {
    expect(UserCreateSchema.safeParse({ ...valid, username: 'sa ra' }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
  });

  it('rejects short passwords and bad emails', () => {
    expect(UserCreateSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('UserUpdateSchema', () => {
  it('lower-cases email and allows clearing it', () => {
    expect(UserUpdateSchema.parse({ email: 'Sara@Tanweel.OM' }).email).toBe('sara@tanweel.om');
    expect(UserUpdateSchema.parse({ email: '' }).email).toBeNull();
  });
});

describe('PasswordChangeSchema', () => {
  it('rejects reusing the current password', () => {
    const r = PasswordChangeSchema.safeParse({ currentPassword: 'samesame1', newPassword: 'samesame1' });
    expect(r.success).toBe(false);
  });

  it('accepts a different, long-enough password', () => {
    const r = PasswordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'brand-new-1' });
    expect(r.success).toBe(true);
  });
});
