-- The "event hall" is renting the entire space (up to its capacity), with no seating layouts to choose.
UPDATE "Room" SET "name" = 'Entire space' WHERE "kind" = 'HALL' AND "name" = 'Event hall';
