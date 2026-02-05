import { StandardCheckoutClient, Env } from "pg-sdk-node"
import { PhonePeOptions } from "../types"

export class PhonePeClientWrapper {
    private client: StandardCheckoutClient

    constructor(options: PhonePeOptions) {
        const env = options.mode === "prod" ? Env.PRODUCTION : Env.SANDBOX
        const { clientId, clientSecret, clientVersion } = this.resolveCredentials(options)
        const shouldPublishEvents = options.shouldPublishEvents ?? true

        this.client = StandardCheckoutClient.getInstance(
            clientId,
            clientSecret,
            clientVersion,
            env,
            shouldPublishEvents
        )
    }

    getClient(): StandardCheckoutClient {
        return this.client
    }

    async pay(payload: any) {
        return this.client.pay(payload)
    }

    async refund(payload: any) {
        return this.client.refund(payload)
    }

    async getOrderStatus(merchantTransactionId: string) {
        return this.client.getOrderStatus(merchantTransactionId)
    }

    async getRefundStatus(refundId: string) {
        return this.client.getRefundStatus(refundId)
    }

    async getTransactionStatus(transactionId: string) {
        return this.client.getTransactionStatus(transactionId)
    }

    async createSdkOrder(payload: any) {
        return this.client.createSdkOrder(payload)
    }

    validateCallback(username: string, password: string, authorization: string, responseBody: string) {
        return this.client.validateCallback(username, password, authorization, responseBody)
    }

    private resolveCredentials(options: PhonePeOptions) {
        const clientId = options.clientId || options.merchantId
        const clientSecret = options.clientSecret || options.saltKey
        const rawVersion = options.clientVersion ?? options.saltIndex

        if (!clientId || !clientSecret || rawVersion === undefined) {
            throw new Error(
                "Missing PhonePe credentials. Provide clientId/clientSecret/clientVersion (preferred) " +
                "or legacy merchantId/saltKey/saltIndex."
            )
        }

        const clientVersion = typeof rawVersion === "number"
            ? rawVersion
            : parseInt(String(rawVersion), 10)

        if (!Number.isFinite(clientVersion)) {
            throw new Error("Invalid PhonePe clientVersion/saltIndex. It must be a number.")
        }

        return { clientId, clientSecret, clientVersion }
    }
}
