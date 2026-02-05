# Necessary Code Updates

1. **Credential model alignment**: Replace `merchantId/saltKey/saltIndex` with `clientId/clientSecret/clientVersion` (per SDK class initialization).
2. **Client initialization**: Ensure only one SDK client instance per process (SDK throws `PhonePeException` on re-init).
3. **Initiate payment request**: Enforce integer amount in paisa (min 100), validate merchant order ID constraints, optionally map Medusa metadata to `metaInfo` fields.
4. **Webhook validation**: Add `callbackUsername`/`callbackPassword` options and validate callbacks via `client.validateCallback(...)` using the Authorization header and raw body.
5. **Refund flow**: Persist `merchantRefundId` and implement `getRefundStatus(refundId)` mapping to Medusa refund status.
6. **Order status**: Align status mapping strictly to SDK states (PENDING/FAILED/COMPLETED).
7. **Provider methods**: Implement explicit behavior for `retrievePayment`, `deletePayment`, `capturePayment`, `cancelPayment` with clear docs and consistent responses.
8. **Data enrichment**: Map Medusa customer/session data into PhonePe `metaInfo` (mobile number, email, device/app metadata if available).
9. **Error handling**: Normalize SDK errors into provider errors; avoid silent failures and surface actionable messages.
