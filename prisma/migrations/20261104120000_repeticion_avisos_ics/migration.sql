-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "repeat" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "repeatUntil" TEXT,
ADD COLUMN     "repeatSkip" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "remind" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "icsToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_icsToken_key" ON "User"("icsToken");
