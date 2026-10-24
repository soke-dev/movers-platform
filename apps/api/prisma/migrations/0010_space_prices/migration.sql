-- No dedicated desks and no VAT on Movers Space prices; "tea and water" is now refreshments at ₦1,000.
-- Old dedicated passes stay (the DEDICATED pass kind is kept) and bookings keep their vat column at 0.
ALTER TABLE "SpaceSettings" DROP COLUMN "dedicated";
ALTER TABLE "SpaceSettings" DROP COLUMN "vatPercent";
ALTER TABLE "SpaceSettings" RENAME COLUMN "teaPerPerson" TO "refreshments";
ALTER TABLE "SpaceSettings" ALTER COLUMN "refreshments" SET DEFAULT 1000;
UPDATE "SpaceSettings" SET "refreshments" = 1000;
