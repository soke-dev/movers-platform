-- Mobile App Development covers publishing to both stores. Only renames the exact old topic,
-- so a topic edited in admin is left alone.
UPDATE "Skill"
SET "topics" = array_replace("topics", 'Publishing to the Play Store', 'Publishing to the Play Store and App Store')
WHERE 'Publishing to the Play Store' = ANY("topics");
