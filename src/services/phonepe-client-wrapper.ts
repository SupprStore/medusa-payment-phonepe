import {
    StandardCheckoutClient,
    Env,
    CallbackResponse,
    CreateSdkOrderRequest,
    PhonePeException,
    ServerError,
    TooManyRequests,
} from "pg-sdk-node"
import { PhonePeOptions } from "../types"

const MAX_RETRIES = 2
const BASE_RETRY_DELAY_MS = 300

function isRetryable(error: unknown): boolean {
    if (!(error instanceof PhonePeException)) {
        // Raw network/timeout errors, not a well-formed PhonePe response - worth a retry.
        return true
    }
    return error instanceof ServerError || error instanceof TooManyRequests
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export class PhonePeClientWrapper {
    private client: StandardCheckoutClient

    constructor(options: PhonePeOptions) {
        const env = options.mode === "prod" ? Env.PRODUCTION : Env.SANDBOX

        this.client = StandardCheckoutClient.getInstance(
            options.clientId,
            options.clientSecret,
            options.clientVersion,
            env,
            true // shouldPublishEvents
        )
    }

    getClient(): StandardCheckoutClient {
        return this.client
    }

    private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
        let attempt = 0
        // merchantOrderId/merchantRefundId are derived from the Medusa session id, so retrying
        // pay/refund with the same request is idempotent from PhonePe's perspective.
        for (; ;) {
            try {
                return await fn()
            } catch (error) {
                if (attempt >= MAX_RETRIES || !isRetryable(error)) {
                    throw error
                }
                await delay(BASE_RETRY_DELAY_MS * 2 ** attempt)
                attempt++
            }
        }
    }

    async pay(payload: any) {
        return this.withRetry(() => this.client.pay(payload))
    }

    async refund(payload: any) {
        return this.withRetry(() => this.client.refund(payload))
    }

    async getOrderStatus(merchantOrderId: string) {
        return this.withRetry(() => this.client.getOrderStatus(merchantOrderId))
    }

    async getRefundStatus(refundId: string) {
        return this.withRetry(() => this.client.getRefundStatus(refundId))
    }

    async createSdkOrder(request: CreateSdkOrderRequest) {
        return this.withRetry(() => this.client.createSdkOrder(request))
    }

    // Local signature verification, no network call - not retried.
    validateCallback(
        username: string,
        password: string,
        authorization: string,
        responseBody: string
    ): CallbackResponse {
        return this.client.validateCallback(username, password, authorization, responseBody)
    }
}
