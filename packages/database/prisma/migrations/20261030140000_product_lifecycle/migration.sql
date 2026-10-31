-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "seoDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoTitle" TEXT NOT NULL DEFAULT '';
