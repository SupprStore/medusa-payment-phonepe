# Medusa PhonePe Payment Provider

This is a PhonePe payment provider module for Medusa v2.

## Installation

```bash
yarn add medusa-payment-phonepe
```


> [!NOTE]
> This package depends on the official PhonePe Node.js SDK which is installed from a custom repository URL. Ensure your environment allows installing packages from `phonepe.mycloudrepo.io`.

(Or link it locally if developing)


## Configuration

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
              merchantId: process.env.PHONEPE_MERCHANT_ID,
              saltKey: process.env.PHONEPE_SALT_KEY,
              saltIndex: process.env.PHONEPE_SALT_INDEX,
              mode: process.env.PHONEPE_MODE, // "uat" or "prod"
              redirectUrl: process.env.PHONEPE_REDIRECT_URL,
              callbackUrl: process.env.PHONEPE_CALLBACK_URL,
              redirectMode: "POST", // "POST" or "GET" (default: POST)
            },
          },
        ],
      },
    },
  ],
})

## Webhooks
To handle asynchronous payment updates (like when a user closes the browser after payment), configure the `callbackUrl` and ensure your Medusa server can receive POST requests at that URL.
The provider implementation verifies the `X-VERIFY` signature from PhonePe.

```

## Environment Variables

```bash
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_MODE=uat
PHONEPE_REDIRECT_URL=http://localhost:8000/payment/callback
PHONEPE_CALLBACK_URL=http://localhost:9000/hooks/payment/phonepe
```
