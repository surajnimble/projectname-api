-- A referrer needs a row that holds only their code; a referee is set later.
-- The unique constraint on refereeId stays so a user can only be referred once.
ALTER TABLE "Referral" ALTER COLUMN "refereeId" DROP NOT NULL;

CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- Any rows left from before (none in a fresh install) get a placeholder code
-- that cannot collide with a generated one, since generated codes are 11 chars.
UPDATE "Referral" SET "referralCode" = 'LEGACY_' || "id" WHERE "referralCode" = '';