import { describe, it, expect } from 'vitest';
import {
  RequestCreateSchema,
  RequestReviewSchema,
  RequestLinkSchema,
  CategorySchema,
  muscatDateTimeInput,
} from '@/lib/request-validation';

describe('request inputs', () => {
  it('requires an explicit timezone and records Oman times across midnight', () => {
    const fields = {
      title: ' Issue ',
      description: ' Details ',
      categoryId: '994d2ecb-751b-45b8-aeb4-10a1f4a38891',
      occurredAt: '2026-10-29T23:30:00+04:00',
    };
    expect(RequestCreateSchema.parse(fields).title).toBe('Issue');
    expect(RequestCreateSchema.safeParse({ ...fields, occurredAt: '2026-10-29T23:30' }).success).toBe(false);
    expect(muscatDateTimeInput(new Date('2026-10-29T22:30:00Z'))).toBe('2026-10-30T02:30');
  });
  it('requires a closure reason, but not a reason to accept or reopen', () => {
    expect(RequestReviewSchema.safeParse({ status: 'Closed', closureReason: '   ' }).success).toBe(false);
    expect(RequestReviewSchema.parse({ status: 'Closed', closureReason: 'Duplicate' }).closureReason).toBe(
      'Duplicate',
    );
    expect(RequestReviewSchema.safeParse({ status: 'New' }).success).toBe(true);
  });
  it('requires bilingual category names and unambiguous task linking', () => {
    expect(CategorySchema.safeParse({ nameEn: 'Issue', nameAr: '' }).success).toBe(false);
    expect(
      RequestLinkSchema.safeParse({
        taskId: '994d2ecb-751b-45b8-aeb4-10a1f4a38891',
        task: { title: 'Other' },
      }).success,
    ).toBe(false);
    expect(RequestLinkSchema.safeParse({ task: { title: 'New' } }).success).toBe(false);
  });
});
