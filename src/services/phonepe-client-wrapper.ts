import { Env, PhonePeException, ServerError, StandardCheckoutClient, TooManyRequests } from "pg-sdk-node"
import { PhonePeOptions } from "../types"

export class PhonePeClientWrapper {
    private static sharedClient?: StandardCheckoutClient
    private static configSignature?: string
    private client: StandardCheckoutClient
    private options: PhonePeOptions

    constructor(options: PhonePeOptions) {
        this.options = options
        const env = options.mode === "prod" ? Env.PRODUCTION : Env.SANDBOX
        const { clientId, clientSecret, clientVersion } = this.resolveCredentials(options)
        const shouldPublishEvents = options.shouldPublishEvents ?? true
        const signature = JSON.stringify({
            clientId,
            clientSecret,
            clientVersion,
            env,
            shouldPublishEvents
        })

        if (PhonePeClientWrapper.sharedClient) {
            if (PhonePeClientWrapper.configSignature !== signature) {
                throw new Error("PhonePe client already initialized with different credentials or environment.")
            }

            this.client = PhonePeClientWrapper.sharedClient
        } else {
            this.client = StandardCheckoutClient.getInstance(
                clientId,
                clientSecret,
                clientVersion,
                env,
                shouldPublishEvents
            )
            PhonePeClientWrapper.sharedClient = this.client
            PhonePeClientWrapper.configSignature = signature
        }
    }

    getClient(): StandardCheckoutClient {
        return this.client
    }

    async pay(payload: any) {
        return this.executeWithRetry(() => this.client.pay(payload))
    }

    async refund(payload: any) {
        return this.executeWithRetry(() => this.client.refund(payload))
    }

    async getOrderStatus(merchantTransactionId: string) {
        return this.executeWithRetry(() => this.client.getOrderStatus(merchantTransactionId))
    }

    async getRefundStatus(refundId: string) {
        return this.executeWithRetry(() => this.client.getRefundStatus(refundId))
    }

    async getTransactionStatus(transactionId: string) {
        return this.executeWithRetry(() => this.client.getTransactionStatus(transactionId))
    }

    async createSdkOrder(payload: any) {
        return this.executeWithRetry(() => this.client.createSdkOrder(payload))
    }

    validateCallback(username: string, password: string, authorization: string, responseBody: string) {
        return this.client.validateCallback(username, password, authorization, responseBody)
    }

    static resetForTests() {
        PhonePeClientWrapper.sharedClient = undefined
        PhonePeClientWrapper.configSignature = undefined
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

    private async executeWithRetry<T>(apiCall: () => Promise<T>, attempt = 1): Promise<T> {
        const maxRetries = this.options.maxRetries ?? 2
        const baseDelay = this.options.retryDelayMs ?? 500

        try {
            return await apiCall()
        } catch (error: any) {
            if (this.shouldRetry(error) && attempt <= maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5)
                await new Promise((resolve) => setTimeout(resolve, delay))
                return this.executeWithRetry(apiCall, attempt + 1)
            }

            throw this.normalizeError(error)
        }
    }

    private shouldRetry(error: any): boolean {
        return (
            error instanceof TooManyRequests ||
            error instanceof ServerError ||
            (error instanceof PhonePeException && (error.httpStatusCode || 0) >= 500)
        )
    }

    private normalizeError(error: any): Error {
        if (error instanceof PhonePeException) {
            const normalized = new Error(error.message)
            normalized.stack = error.stack
            ;(normalized as any).phonepe = {
                type: error.type,
                code: error.code,
                httpStatusCode: error.httpStatusCode,
                data: error.data,
            }
            return normalized
        }

        return error
    }
}
