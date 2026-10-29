import { describe, expect, it } from 'vitest';
import {
  LoginSchema,
  PasswordChangeSchema,
  ProjectCreateSchema,
  TaskFormSchema,
  TaskListQuerySchema,
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
  it('defaults status and description', () => {
    expect(TaskFormSchema.parse({ title: 'Fix invoice' })).toEqual({
      title: 'Fix invoice',
      descriptionHtml: '',
      status: 'Todo',
    });
  });

  it('rejects a blank title', () => {
    expect(TaskFormSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('TaskListQuerySchema', () => {
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
