-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('TRANSFER', 'COD');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('COLLECTING', 'PENDING_FULFILLMENT', 'SHIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT,
    "paymentMethod" "payment_method" NOT NULL DEFAULT 'TRANSFER',
    "amount" DOUBLE PRECISION,
    "items" TEXT,
    "slipVerified" BOOLEAN NOT NULL DEFAULT false,
    "slipReferenceId" TEXT,
    "slipImageUrl" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'PENDING_FULFILLMENT',
    "trackingNumber" TEXT,
    "note" TEXT,
    "shippedBy" TEXT,
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_threadId_idx" ON "order"("threadId");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");
