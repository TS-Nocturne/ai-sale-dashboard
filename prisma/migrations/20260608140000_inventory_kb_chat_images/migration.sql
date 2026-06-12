-- CreateEnum
CREATE TYPE "knowledge_status" AS ENUM ('PENDING', 'INDEXED', 'FAILED');

-- AlterTable: Product gains structured inventory fields (sku/category/stock)
ALTER TABLE "product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Message can reference an image the customer sent
ALTER TABLE "message" ADD COLUMN     "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "knowledge_document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "status" "knowledge_status" NOT NULL DEFAULT 'PENDING',
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_document_status_idx" ON "knowledge_document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_category_idx" ON "product"("category");
