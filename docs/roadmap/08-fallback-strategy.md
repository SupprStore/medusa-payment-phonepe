# Fallback / Recovery Strategy

- **Webhook failure fallback**: Implemented reconciliation helpers `reconcilePayments` for polling PENDING orders.
- **Refund reconciliation**: Implemented `reconcileRefunds` for polling refund status.
- **Transient failure retries**: Implemented retries for transient SDK errors.
