-- Payment reconciliation: partial/overpay tracking + slip history + customer wallet

CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PARTIAL_PAID', 'PAID', 'PENDING_REFUND', 'CANCELLED');
CREATE TYPE "overpay_resolution" AS ENUM ('KEPT_AS_CREDIT', 'PENDING_REFUND', 'REFUNDED');

ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "lineUserId" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "storeCredit" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS "customer_lineUserId_key" ON "customer"("lineUserId");

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "paymentStatus" "payment_status" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "overpaidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "overpayResolution" "overpay_resolution";

UPDATE "order" SET "totalAmount" = "amount" WHERE "totalAmount" IS NULL AND "amount" IS NOT NULL;
UPDATE "order" SET "paidAmount" = "amount", "paymentStatus" = 'PAID'
WHERE "slipVerified" = true AND "amount" IS NOT NULL AND "paidAmount" = 0;

CREATE INDEX IF NOT EXISTS "order_paymentStatus_idx" ON "order"("paymentStatus");

ALTER TABLE "order" ADD CONSTRAINT "order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "payment_slip" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "referenceId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_slip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_slip_referenceId_key" ON "payment_slip"("referenceId");
CREATE INDEX IF NOT EXISTS "payment_slip_orderId_idx" ON "payment_slip"("orderId");

ALTER TABLE "payment_slip" ADD CONSTRAINT "payment_slip_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
