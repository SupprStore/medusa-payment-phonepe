# Fallback / Recovery Strategy

- **Webhook failure fallback**: Periodically poll `getOrderStatus()` for PENDING orders to reconcile in case callback is missed.
- **Refund reconciliation**: Poll `getRefundStatus(refundId)` until terminal state for refunds.
- **Transient failure retries**: Retry SDK calls on transient `PhonePeException` errors with exponential backoff.
