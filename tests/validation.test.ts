import { describe, expect, it } from 'vitest';
import { LoginSchema, TaskCreateSchema, TaskListQuerySchema } from '@/lib/validation';

describe('LoginSchema', () => {
  it('trims and lower-cases the identifier', () => {
    const parsed = LoginSchema.parse({ identifier: '  Ali@Tanweel.OM ', password: 'x' });
    expect(parsed.identifier).toBe('ali@tanweel.om');
  });

  it('rejects an empty password', () => {
    expect(LoginSchema.safeParse({ identifier: 'ali', password: '' }).success).toBe(false);
  });
});

describe('TaskCreateSchema', () => {
  it('defaults status and description', () => {
    expect(TaskCreateSchema.parse({ title: 'Fix invoice' })).toEqual({
      title: 'Fix invoice',
      descriptionHtml: '',
      status: 'Open',
    });
  });

  it('rejects a blank title', () => {
    expect(TaskCreateSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('TaskListQuerySchema', () => {
  it('rejects unknown statuses', () => {
    expect(TaskListQuerySchema.safeParse({ status: 'Done' }).success).toBe(false);
  });
});
