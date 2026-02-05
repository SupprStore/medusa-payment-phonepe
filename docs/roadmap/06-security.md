# Security Findings

- **Webhook verification mismatch**: Current `x-verify` hash validation does not match the SDK’s documented callback verification flow (username/password + Authorization header). This could allow forged callbacks if PhonePe sends Basic Auth–validated callbacks.
- **No validation of order ID/amount in webhook**: Callback processing trusts decoded payload without confirming it matches known merchant order IDs or amounts in Medusa.
- **Credential naming risk**: Using `merchantId/saltKey` suggests API-integration credentials, which do not match Node SDK’s `clientId/clientSecret` requirements.
