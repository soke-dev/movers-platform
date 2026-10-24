-- The 10-day bundle becomes a weekly pass (7 days in a row). Old bundle passes keep working.
ALTER TYPE "PassKind" ADD VALUE 'WEEKLY';

-- Renamed, not recreated, so a price set in admin is kept.
ALTER TABLE "SpaceSettings" RENAME COLUMN "bundle10" TO "weekly";

-- The old starting price (₦25,000 for 10 days) becomes the new weekly starting price.
UPDATE "SpaceSettings" SET "weekly" = 15000 WHERE "weekly" = 25000;
