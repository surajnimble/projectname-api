/**
 * Schema-side ceiling for the gift-wrap note. The charge itself is a runtime
 * setting (`cartGiftWrapCharge`), so the service re-trims against the live value.
 */
export const GIFT_WRAP = {
  NOTE_MAX_LENGTH: 200,
};
