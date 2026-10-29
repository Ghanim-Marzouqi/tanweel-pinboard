-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "assigneeId" UUID,
ADD COLUMN     "checklistDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "checklistTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "descriptionText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'Medium';

-- CreateIndex
CREATE INDEX "tasks_projectId_dueDate_idx" ON "tasks"("projectId", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_status_dueDate_idx" ON "tasks"("assigneeId", "status", "dueDate");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill the derived columns for tasks that already exist (later saves
-- recompute them in the app).
UPDATE "tasks" SET
  "descriptionText" = btrim(regexp_replace(
    replace(replace(replace(replace(replace(
      regexp_replace("descriptionHtml", '<[^>]+>', ' ', 'g'),
      '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&amp;', '&'),
    '\s+', ' ', 'g')),
  "checklistTotal" = regexp_count("descriptionHtml", '<li[^>]*data-type="taskItem"'),
  "checklistDone" = regexp_count("descriptionHtml", '<li[^>]*data-checked="true"[^>]*data-type="taskItem"|<li[^>]*data-type="taskItem"[^>]*data-checked="true"');
