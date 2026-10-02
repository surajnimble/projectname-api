-- The referrer's code row and every applied referral repeat the same code, so a
-- unique index makes the second referral impossible to write.
-- Code lookups always filter on `refereeId IS NULL`, which is the single
-- authoritative code row for that referrer.
DROP INDEX IF EXISTS "Referral_referralCode_key";

CREATE INDEX IF NOT EXISTS "Referral_referralCode_idx" ON "Referral"("referralCode");