# Medusa PhonePe Payment Provider

This is a PhonePe payment provider module for Medusa v2.

## Installation

### From npm (if published)
```bash
yarn add medusa-payment-phonepe
```

### Local Development
1. Run `yarn build` in this directory.
2. Run `yarn link` in this directory.
3. In your Medusa backend directory, run `yarn link medusa-payment-phonepe`.


## Configuration
Legacy `merchantId/saltKey/saltIndex` are deprecated. Use `clientId/clientSecret/clientVersion`.

In `medusa-config.ts`:

```typescript
module.exports = defineConfig({
  projectConfig: {
    // ...
  },
  modules: [
    {
      resolve: "@medusajs/payment",
      options: {
        providers: [
          {
            resolve: "medusa-payment-phonepe",
            id: "phonepe",
            options: {
              clientId: process.env.PHONEPE_CLIENT_ID,
              clientSecret: process.env.PHONEPE_CLIENT_SECRET,
              clientVersion: process.env.PHONEPE_CLIENT_VERSION,
              mode: process.env.PHONEPE_MODE, // "uat" or "prod"
              redirectUrl: process.env.PHONEPE_REDIRECT_URL,
              callbackUrl: process.env.PHONEPE_CALLBACK_URL,
              callbackUsername: process.env.PHONEPE_CALLBACK_USERNAME,
              callbackPassword: process.env.PHONEPE_CALLBACK_PASSWORD,
              webhookVerifyWithApi: true,
              maxRetries: 2,
              retryDelayMs: 500,
            },
          },
        ],
      },
    },
  ],
})

## Webhooks
To handle asynchronous payment updates (like when a user closes the browser after payment), configure the `callbackUrl` and ensure your Medusa server can receive POST requests at that URL.
The provider validates callbacks using the SDK `validateCallback` method, which expects the `authorization` header plus the callback username/password configured on the PhonePe dashboard.

## Mobile SDK Order (Optional)
For mobile SDK flows, this provider exposes a `createSdkOrder` method that returns the SDK order token inside `data.sdkOrder`.

## Reconciliation Helpers
If webhooks are missed, you can reconcile with:
- `reconcilePayments(merchantOrderIds: string[])`
- `reconcileRefunds(refundIds: string[])`

```

## Environment Variables

```bash
PHONEPE_CLIENT_ID=your_client_id
PHONEPE_CLIENT_SECRET=your_client_secret
PHONEPE_CLIENT_VERSION=1
PHONEPE_MODE=uat
PHONEPE_REDIRECT_URL=http://localhost:8000/payment/callback
PHONEPE_CALLBACK_URL=http://localhost:9000/hooks/payment/phonepe
PHONEPE_CALLBACK_USERNAME=your_callback_username
PHONEPE_CALLBACK_PASSWORD=your_callback_password
```
