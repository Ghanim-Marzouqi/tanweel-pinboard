import { describe, expect, it } from 'vitest';
import {
  canDeleteOwnedItem,
  canManageProject,
  canWriteInProject,
  visibleProjectsWhere,
  visibleTasksWhere,
  type Actor,
} from '@/lib/access';

const admin: Actor = { id: 'admin-1', role: 'admin' };
const owner: Actor = { id: 'owner-1', role: 'member' };
const member: Actor = { id: 'member-1', role: 'member' };
const active = { ownerId: owner.id, isArchived: false };
const archived = { ownerId: owner.id, isArchived: true };

describe('project visibility', () => {
  it('admins see every project', () => {
    expect(visibleProjectsWhere(admin)).toEqual({});
    expect(visibleTasksWhere(admin)).toEqual({});
  });

  it('members only see projects they belong to', () => {
    expect(visibleProjectsWhere(member)).toEqual({ members: { some: { userId: member.id } } });
    expect(visibleTasksWhere(member)).toEqual({
      project: { members: { some: { userId: member.id } } },
    });
  });
});

describe('canManageProject', () => {
  it('allows the owner and admins only', () => {
    expect(canManageProject(owner, active)).toBe(true);
    expect(canManageProject(admin, active)).toBe(true);
    expect(canManageProject(member, active)).toBe(false);
  });
});

describe('canWriteInProject', () => {
  it('is false for archived projects', () => {
    expect(canWriteInProject(active)).toBe(true);
    expect(canWriteInProject(archived)).toBe(false);
  });
});

describe('canDeleteOwnedItem', () => {
  it('allows the author, the owner and admins', () => {
    expect(canDeleteOwnedItem(member, active, member.id)).toBe(true);
    expect(canDeleteOwnedItem(owner, active, member.id)).toBe(true);
    expect(canDeleteOwnedItem(admin, active, member.id)).toBe(true);
  });

  it('denies other members', () => {
    expect(canDeleteOwnedItem(member, active, 'someone-else')).toBe(false);
  });

  it('denies everyone in archived projects', () => {
    expect(canDeleteOwnedItem(admin, archived, admin.id)).toBe(false);
    expect(canDeleteOwnedItem(member, archived, member.id)).toBe(false);
  });
});
