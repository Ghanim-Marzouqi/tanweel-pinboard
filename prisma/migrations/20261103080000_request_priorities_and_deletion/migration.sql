CREATE TABLE "request_priorities" (
  "id" UUID NOT NULL,
  "nameEn" VARCHAR(80) NOT NULL,
  "nameAr" VARCHAR(80) NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "request_priorities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "request_priorities_nameEn_key" ON "request_priorities"("nameEn");
CREATE UNIQUE INDEX "request_priorities_nameAr_key" ON "request_priorities"("nameAr");
ALTER TABLE "work_requests" ADD COLUMN "priorityId" UUID;
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_priorityId_fkey"
  FOREIGN KEY ("priorityId") REFERENCES "request_priorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- A linked request must never be removed by cascading its task links.
ALTER TABLE "request_task_links" DROP CONSTRAINT "request_task_links_requestId_fkey";
ALTER TABLE "request_task_links" ADD CONSTRAINT "request_task_links_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "request_priorities" ("id", "nameEn", "nameAr", "sortOrder") VALUES
 ('b7e2a1c0-3300-4000-8000-000000000001', 'Low', 'منخفضة', 10),
 ('b7e2a1c0-3300-4000-8000-000000000002', 'Medium', 'متوسطة', 20),
 ('b7e2a1c0-3300-4000-8000-000000000003', 'High', 'عالية', 30),
 ('b7e2a1c0-3300-4000-8000-000000000004', 'Urgent', 'عاجلة', 40);
