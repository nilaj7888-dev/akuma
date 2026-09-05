-- Brings the database in line with schema.prisma. These columns were added to
-- the schema (and the generated client) but never migrated, so every read of
-- User / Merchant / Policy failed with `column ... does not exist` — which is
-- what broke sign-in and the dashboard.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingSmsConsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: email is optional now that accounts can be phone-only
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "deliveryRadius" TEXT;

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "negotiationPreference" TEXT NOT NULL DEFAULT 'ASK_ME_FIRST';

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");
