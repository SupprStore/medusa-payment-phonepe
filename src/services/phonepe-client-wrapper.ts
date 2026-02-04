import { StandardCheckoutClient, Env } from "pg-sdk-node"
import { PhonePeOptions } from "../types"

export class PhonePeClientWrapper {
    private client: StandardCheckoutClient

    constructor(options: PhonePeOptions) {
        const env = options.mode === "prod" ? Env.PRODUCTION : Env.SANDBOX
        const clientVersion = parseInt(options.saltIndex || "1", 10)

        this.client = StandardCheckoutClient.getInstance(
            options.merchantId,
            options.saltKey,
            clientVersion,
            env,
            true // shouldPublishEvents
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
}
