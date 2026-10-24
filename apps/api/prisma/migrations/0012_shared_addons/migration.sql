-- The meeting room uses the same add-ons as the hall (TV, sound, refreshments, cleaning),
-- so its separate refreshments price goes.
ALTER TABLE "SpaceSettings" DROP COLUMN "refreshments";
