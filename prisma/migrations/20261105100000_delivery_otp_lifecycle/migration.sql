-- Store only a keyed HMAC digest of the delivery OTP and enforce a bounded validity window.
ALTER TABLE "Delivery"
  ADD COLUMN "deliveryOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "deliveryOtpAttempts" INTEGER NOT NULL DEFAULT 0;

-- Existing legacy values cannot be trusted as verified credentials. Clear them so that
-- only a newly assigned rider receives a newly generated code.
UPDATE "Delivery"
SET "deliveryOtp" = '', "deliveryOtpExpiresAt" = NULL, "deliveryOtpAttempts" = 0, "otpVerifiedAt" = NULL;
