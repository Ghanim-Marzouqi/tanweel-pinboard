CREATE TYPE "NotificationKind" AS ENUM ('RequestComment', 'RequestStatus', 'TaskComment', 'TaskStatus');
CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "actorId" UUID,
  "requestId" UUID,
  "taskId" UUID,
  "kind" "NotificationKind" NOT NULL,
  "eventKey" VARCHAR(100) NOT NULL,
  "fromStatus" VARCHAR(30),
  "toStatus" VARCHAR(30),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_target" CHECK (
    ("requestId" IS NOT NULL AND "taskId" IS NULL AND "kind" IN ('RequestComment', 'RequestStatus')) OR
    ("taskId" IS NOT NULL AND "requestId" IS NULL AND "kind" IN ('TaskComment', 'TaskStatus'))
  )
);
CREATE UNIQUE INDEX "notifications_recipientId_eventKey_key" ON "notifications"("recipientId", "eventKey");
CREATE INDEX "notifications_recipientId_readAt_createdAt_idx" ON "notifications"("recipientId", "readAt", "createdAt");
CREATE INDEX "notifications_recipientId_createdAt_id_idx" ON "notifications"("recipientId", "createdAt", "id");
CREATE INDEX "notifications_requestId_idx" ON "notifications"("requestId");
CREATE INDEX "notifications_taskId_idx" ON "notifications"("taskId");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "work_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
