-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('New', 'UnderReview', 'Accepted', 'Closed');

-- CreateTable
CREATE TABLE "request_categories" (
    "id" UUID NOT NULL,
    "nameEn" VARCHAR(80) NOT NULL,
    "nameAr" VARCHAR(80) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "request_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_requests" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "projectId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "suggestions" TEXT NOT NULL DEFAULT '',
    "shift" VARCHAR(120) NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'New',
    "closureReason" VARCHAR(2000) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_activities" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_task_links" (
    "requestId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "creationKey" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_task_links_pkey" PRIMARY KEY ("requestId","taskId")
);

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "contentType" VARCHAR(150) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_categories_nameEn_key" ON "request_categories"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "request_categories_nameAr_key" ON "request_categories"("nameAr");

-- CreateIndex
CREATE UNIQUE INDEX "work_requests_number_key" ON "work_requests"("number");

-- CreateIndex
CREATE INDEX "work_requests_projectId_createdById_createdAt_idx" ON "work_requests"("projectId", "createdById", "createdAt");

-- CreateIndex
CREATE INDEX "work_requests_projectId_status_createdAt_idx" ON "work_requests"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "request_activities_requestId_createdAt_idx" ON "request_activities"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "request_task_links_creationKey_key" ON "request_task_links"("creationKey");

-- CreateIndex
CREATE INDEX "request_task_links_taskId_idx" ON "request_task_links"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "request_attachments_storageKey_key" ON "request_attachments"("storageKey");

-- CreateIndex
CREATE INDEX "request_attachments_requestId_idx" ON "request_attachments"("requestId");

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "request_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_activities" ADD CONSTRAINT "request_activities_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "work_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_activities" ADD CONSTRAINT "request_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_task_links" ADD CONSTRAINT "request_task_links_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "work_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_task_links" ADD CONSTRAINT "request_task_links_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "work_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Initial categories are editable; archiving preserves historical selections.
INSERT INTO "request_categories" ("id", "nameEn", "nameAr") VALUES
 ('994d2ecb-751b-45b8-aeb4-10a1f4a38891', 'Technical issue', 'مشكلة تقنية'),
 ('994d2ecb-751b-45b8-aeb4-10a1f4a38892', 'Enhancement', 'تحسين'),
 ('994d2ecb-751b-45b8-aeb4-10a1f4a38893', 'Suggestion', 'اقتراح'),
 ('994d2ecb-751b-45b8-aeb4-10a1f4a38894', 'Observation', 'ملاحظة');
