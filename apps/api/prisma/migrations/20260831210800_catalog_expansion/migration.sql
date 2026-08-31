-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GarmentType" ADD VALUE 'ZIPHOODIE';
ALTER TYPE "GarmentType" ADD VALUE 'BEANIE';
ALTER TYPE "GarmentType" ADD VALUE 'MUG';
ALTER TYPE "GarmentType" ADD VALUE 'TUMBLER';
ALTER TYPE "GarmentType" ADD VALUE 'BLANKET';
ALTER TYPE "GarmentType" ADD VALUE 'PILLOW';
ALTER TYPE "GarmentType" ADD VALUE 'APRON';
ALTER TYPE "GarmentType" ADD VALUE 'MOUSEPAD';
ALTER TYPE "GarmentType" ADD VALUE 'ORNAMENT';
ALTER TYPE "GarmentType" ADD VALUE 'PHONECASE';
ALTER TYPE "GarmentType" ADD VALUE 'STICKER';
ALTER TYPE "GarmentType" ADD VALUE 'POSTER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrintMethod" ADD VALUE 'SUBLIMATION';
ALTER TYPE "PrintMethod" ADD VALUE 'UV_PRINT';
ALTER TYPE "PrintMethod" ADD VALUE 'ENGRAVING';
ALTER TYPE "PrintMethod" ADD VALUE 'DIGITAL_PRINT';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'apparel',
ADD COLUMN     "sizes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "src2x" TEXT,
    "alt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "colorId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_productId_src_key" ON "product_images"("productId", "src");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
