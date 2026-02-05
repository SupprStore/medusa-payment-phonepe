# Current Implementation Snapshot

- Uses options: `merchantId`, `saltKey`, `saltIndex`, `mode`, `redirectUrl`, `callbackUrl`.
- Initializes `StandardCheckoutClient` with (merchantId, saltKey, saltIndex, env, shouldPublishEvents).
- Implements pay (initiate), order status, refund; **no refund status** method.
- Webhook verification uses `x-verify` hash + base64 response decoding.
- `merchantTransactionId` generated via timestamp when not provided.
