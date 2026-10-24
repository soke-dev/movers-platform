-- One meeting room, booked by the day; the event hall (the full space) by the day, up to 30 guests.

-- Rooms are priced per day now.
ALTER TABLE "Room" RENAME COLUMN "hourlyRate" TO "dayRate";

-- Room A becomes the one meeting room: a round table for 10. Room B's bookings move to it, then it goes.
UPDATE "Room" SET "slug" = 'meeting-room', "name" = 'Meeting room', "capacity" = 10, "dayRate" = 30000 WHERE "slug" = 'room-a';
UPDATE "Booking" SET "roomId" = (SELECT "id" FROM "Room" WHERE "slug" = 'meeting-room')
  WHERE "roomId" = (SELECT "id" FROM "Room" WHERE "slug" = 'room-b') AND EXISTS (SELECT 1 FROM "Room" WHERE "slug" = 'meeting-room');
DELETE FROM "Room" WHERE "slug" = 'room-b' AND NOT EXISTS (SELECT 1 FROM "Booking" b JOIN "Room" r ON r."id" = b."roomId" WHERE r."slug" = 'room-b');

-- The hall seats up to 30, in every layout.
UPDATE "Room" SET "capacity" = 30 WHERE "kind" = 'HALL';
UPDATE "SpaceSettings" SET "layouts" = (
  SELECT jsonb_agg(jsonb_set(l, '{capacity}', to_jsonb(LEAST((l->>'capacity')::int, 30))))
  FROM jsonb_array_elements("layouts") l
);

-- One full-day hall price, kept from the old full-day block.
UPDATE "SpaceSettings" SET "hallPackages" = jsonb_build_array(jsonb_build_object(
  'id', 'day', 'name', 'Full day', 'start', 8, 'end', 20,
  'price', COALESCE((SELECT (p->>'price')::int FROM jsonb_array_elements("hallPackages") p WHERE p->>'id' = 'full'), 100000)
));

-- Hall add-ons: a 55-inch TV instead of the projector, sound system with mic, refreshments (price kept), extra cleaning.
UPDATE "SpaceSettings" SET "addons" = jsonb_build_array(
  jsonb_build_object('id', 'tv', 'name', '55-inch TV', 'price', 5000, 'perGuest', false),
  jsonb_build_object('id', 'sound', 'name', 'Sound system with mic', 'price', 5000, 'perGuest', false),
  jsonb_build_object('id', 'food', 'name', 'Refreshments', 'perGuest', true,
    'price', COALESCE((SELECT (a->>'price')::int FROM jsonb_array_elements("addons") a WHERE a->>'id' = 'food'), 1500)),
  jsonb_build_object('id', 'cleaning', 'name', 'Extra cleaning', 'price', 2000, 'perGuest', false)
);
