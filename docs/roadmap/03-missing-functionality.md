# Missing Functionality

1. **Create SDK Order** for mobile SDK flows (no implementation, no API surface).
2. **Refund status retrieval** using `getRefundStatus(refundId)` is not implemented.
3. **Callback verification via SDK** (`validateCallback`) is not implemented.
4. **PhonePeException handling** is not surfaced or typed; errors are logged but not inspected/normalized.
5. **Provider method implementations** are stubbed:
   - `retrievePayment`: should fetch and map the latest PhonePe order status for the Medusa session ID.
   - `deletePayment`: should be explicit no-op with documented behavior (PhonePe does not support hard deletion).
   - `capturePayment`: should be explicit no-op or status refresh (PhonePe pay is auto-captured).
   - `cancelPayment`: should attempt a cancel/refund flow if supported, or be explicit no-op with logging.
6. **Data enrichment** is missing:
   - No mapping of Medusa customer details (email/phone) or device metadata into PhonePe `metaInfo`.
   - Mobile SDK flow context (if used) is not represented or persisted.
7. **Robustness & error handling gaps**:
   - No standardized error mapping from SDK errors to Medusa errors.
   - No retry/backoff strategy for transient SDK failures.
8. **Unit testing strategy** is minimal:
   - Current tests cover only core happy-paths; no negative cases for missing provider methods, refund status, or webhook failures beyond signature mismatches.
