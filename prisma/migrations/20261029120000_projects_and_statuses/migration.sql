-- Users: forced password change + session invalidation
ALTER TABLE "users"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Projects and their members
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_members" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("projectId","userId")
);

CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing tasks (if any) move into a "General" project owned by the first
-- admin, with everyone who created or commented on them as members.
ALTER TABLE "tasks" ADD COLUMN "projectId" UUID;

DO $$
DECLARE
  general_id UUID := gen_random_uuid();
  owner_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM "tasks") THEN
    SELECT "id" INTO owner_id FROM "users"
      ORDER BY ("role" = 'admin') DESC, "createdAt" ASC LIMIT 1;

    INSERT INTO "projects" ("id", "name", "updatedAt", "ownerId")
      VALUES (general_id, 'General', CURRENT_TIMESTAMP, owner_id);

    INSERT INTO "project_members" ("projectId", "userId")
      SELECT general_id, u FROM (
        SELECT owner_id AS u
        UNION SELECT "createdById" FROM "tasks"
        UNION SELECT "authorId" FROM "task_comments"
        UNION SELECT "uploadedById" FROM "task_attachments"
      ) AS people;

    UPDATE "tasks" SET "projectId" = general_id;
  END IF;
END $$;

ALTER TABLE "tasks" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "tasks_status_idx";
CREATE INDEX "tasks_projectId_status_idx" ON "tasks"("projectId", "status");

-- Statuses: Open/InProgress/Resolved/Closed -> Todo/InProgress/InReview/Done
CREATE TYPE "TaskStatus_new" AS ENUM ('Todo', 'InProgress', 'InReview', 'Done');
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING (
  CASE "status"::text
    WHEN 'Open' THEN 'Todo'
    WHEN 'InProgress' THEN 'InProgress'
    WHEN 'Resolved' THEN 'InReview'
    ELSE 'Done'
  END
)::"TaskStatus_new";
DROP TYPE "TaskStatus";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'Todo';
