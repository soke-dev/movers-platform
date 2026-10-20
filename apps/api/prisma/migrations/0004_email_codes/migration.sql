-- DropIndex
DROP INDEX "User_appleId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "appleId";

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

