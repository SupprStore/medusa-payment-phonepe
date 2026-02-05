# Security Findings

- **Webhook verification mismatch**: Mitigated by using SDK `validateCallback` when authorization header and callback credentials are provided. Legacy `x-verify` remains as fallback for backward compatibility.
- **No validation of order ID/amount in webhook**: Mitigated by verifying webhook payload against `getOrderStatus(merchantOrderId)` when `webhookVerifyWithApi` is enabled (default).
- **Credential naming risk**: Mitigated by supporting SDK-aligned `clientId/clientSecret/clientVersion` and warning when legacy keys are used.
