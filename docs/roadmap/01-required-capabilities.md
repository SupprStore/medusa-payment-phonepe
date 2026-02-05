# Required SDK Capabilities (per PhonePe docs)

- Initialize `StandardCheckoutClient` with **clientId**, **clientSecret**, **clientVersion**, and **env** (single instance)
- Initiate payment with merchant order ID and amount in **paisa**, optional meta info, and redirect URL
- Create SDK Order (order token for mobile SDK flows)
- Check order status via `getOrderStatus(merchantOrderId)`
- Initiate refund and **check refund status** via `getRefundStatus(refundId)`
- Verify callbacks via `validateCallback(username, password, authorizationHeader, responseBody)`
- Handle SDK errors via `PhonePeException`
