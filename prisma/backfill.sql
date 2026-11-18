-- Ek baar chalao (npm run db:backfill) — purani leads ka lastWebhookAt bhar deta hai
UPDATE "Lead" l
SET "lastWebhookAt" = COALESCE(
  (SELECT MAX(a."createdAt") FROM "Activity" a WHERE a."leadId" = l."id" AND a."type" IN ('CREATED', 'WEBHOOK')),
  l."createdAt"
)
WHERE l."lastWebhookAt" IS NULL;
