-- CreateEnum
CREATE TYPE "bot_status" AS ENUM ('ACTIVE', 'PAUSED_FOR_HUMAN');

-- CreateEnum
CREATE TYPE "approval_action" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "chat_thread" (
    "id" TEXT NOT NULL,
    "botStatus" "bot_status" NOT NULL DEFAULT 'ACTIVE',
    "handoffReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION,
    "reason" TEXT,
    "status" "approval_action" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_thread_botStatus_idx" ON "chat_thread"("botStatus");

-- CreateIndex
CREATE INDEX "approval_request_threadId_idx" ON "approval_request"("threadId");

-- CreateIndex
CREATE INDEX "approval_request_status_idx" ON "approval_request"("status");

-- AddForeignKey
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
