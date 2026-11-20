-- Fleet Metrics rollups (prisma model FleetRollup). Run once in the Neon SQL editor
-- (port 5432 is blocked from the office, so `prisma db push` can't run there).
CREATE TABLE IF NOT EXISTS "fleet_rollups" (
    "source" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fleet_rollups_pkey" PRIMARY KEY ("source", "bucket")
);
