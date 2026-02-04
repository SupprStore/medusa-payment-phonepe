import {
    AbstractPaymentProvider,
    PaymentSessionStatus
} from "@medusajs/framework/utils"
import {
    Logger,
    ProviderWebhookPayload,
    WebhookActionResult
} from "@medusajs/types"
import {
    StandardCheckoutClient,
    StandardCheckoutPayRequest,
    RefundRequest,
    Env
} from "pg-sdk-node"
import * as crypto from "crypto"
import { PhonePeOptions } from "../types"

export class PhonePeProvider extends AbstractPaymentProvider<PhonePeOptions> {
    static identifier = "phonepe"
    protected options_: PhonePeOptions
    protected logger_: Logger
    protected client_: StandardCheckoutClient

    constructor(container: { logger: Logger }, options: PhonePeOptions) {
        super(container, options)
        this.options_ = options
        this.logger_ = container.logger

        const env = this.options_.mode === "prod" ? Env.PRODUCTION : Env.SANDBOX
        const clientVersion = parseInt(this.options_.saltIndex || "1", 10)

        // Initialize PhonePe SDK Client
        this.client_ = StandardCheckoutClient.getInstance(
            this.options_.merchantId,
            this.options_.saltKey,
            clientVersion,
            env,
            true // shouldPublishEvents
        )
    }

    async initiatePayment(input: any): Promise<any> {
        const { amount, currency_code, context } = input

        const merchantTransactionId = context?.payment_session_data?.merchantTransactionId || `MT${Date.now()}`
        // PhonePe expects amount in paise (integers)
        const phonePeAmount = Math.round(amount)

        const callbackUrl = this.options_.callbackUrl || `${context.context?.origin || ""}/phonepe/callback`
        const redirectUrl = this.options_.redirectUrl || callbackUrl

        try {
            const requestBuilder = StandardCheckoutPayRequest.builder()
                .merchantOrderId(merchantTransactionId)
                .amount(phonePeAmount)
                .redirectUrl(redirectUrl)
                .message("Payment for Order")

            // Mobile number and merchantUserId are not directly exposed in StandardCheckoutPayRequest v2 builder
            // They might be needed for specific flows but Standard Checkout usually collects info on the page.

            const payload = requestBuilder.build()
            const response = await this.client_.pay(payload)

            return {
                id: merchantTransactionId, // Medusa needs an ID
                redirectUrl: response.redirectUrl,
                merchantTransactionId
            }
        } catch (error: any) {
            this.logger_.error(`PhonePe initiation failed: ${error.message}`)
            throw error
        }
    }

    async authorizePayment(input: any): Promise<any> {
        const paymentSessionData = input
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string

        try {
            const statusResponse = await this.client_.getOrderStatus(merchantTransactionId)

            // Check state instead of code
            if (statusResponse.state === "COMPLETED") {
                return {
                    status: PaymentSessionStatus.AUTHORIZED,
                    data: {
                        ...paymentSessionData,
                        paymentId: statusResponse.orderId || statusResponse.merchantOrderId
                    }
                }
            }

            if (statusResponse.state === "PENDING" || statusResponse.state === "On Progress") { // Checking potential pending states
                return {
                    status: PaymentSessionStatus.PENDING,
                    data: paymentSessionData
                }
            }

            return {
                status: PaymentSessionStatus.ERROR,
                data: {
                    ...paymentSessionData,
                    error: statusResponse.state || "Payment failed"
                }
            }
        } catch (error: any) {
            return {
                status: PaymentSessionStatus.ERROR,
                data: {
                    ...paymentSessionData,
                    error: error.message
                }
            }
        }
    }

    async cancelPayment(input: any): Promise<any> {
        return input
    }

    async capturePayment(input: any): Promise<any> {
        // PhonePe 'pay' is usually auto-captured.
        return {
            ...input,
            status: "captured"
        }
    }

    async refundPayment(input: any): Promise<any> {
        const paymentSessionData = input.data || input
        const refundAmount = input.amount
        const amount = Math.round(refundAmount)

        const merchantTransactionId = `REF-${Date.now()}`
        const originalTransactionId = paymentSessionData.merchantTransactionId as string

        try {
            const refundBuilder = RefundRequest.builder()
                .merchantRefundId(merchantTransactionId)
                .amount(amount)
                .originalMerchantOrderId(originalTransactionId)

            const response = await this.client_.refund(refundBuilder.build())

            if (response.state === "COMPLETED" || response.state === "SUCCESS" || response.state === "PAYMENT_SUCCESS") {
                return {
                    ...paymentSessionData,
                    refundParams: response
                }
            } else {
                // Even if not completed, we might return data for tracking?
                // But Medusa expects success. 
                throw new Error(`Refund state: ${response.state}`)
            }
        } catch (error: any) {
            this.logger_.error(`PhonePe Refund Error: ${error.message}`)
            throw error
        }
    }

    async getPaymentStatus(input: any): Promise<any> {
        const paymentSessionData = input
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string

        try {
            const statusResponse = await this.client_.getOrderStatus(merchantTransactionId)
            if (statusResponse.state === "COMPLETED") {
                return { status: PaymentSessionStatus.AUTHORIZED }
            }
            if (statusResponse.state === "PENDING") {
                return { status: PaymentSessionStatus.PENDING }
            }
            return { status: PaymentSessionStatus.ERROR }
        } catch (e) {
            return { status: PaymentSessionStatus.ERROR }
        }
    }

    async deletePayment(input: any): Promise<any> {
        return input
    }

    async retrievePayment(input: any): Promise<any> {
        return input
    }

    async updatePayment(input: any): Promise<any> {
        return this.initiatePayment(input)
    }

    async getWebhookActionAndData(
        payload: ProviderWebhookPayload["payload"]
    ): Promise<WebhookActionResult> {
        const { data, headers } = payload

        // 1. Verify Signature
        const xVerify = headers["x-verify"]
        if (!xVerify) {
            return { action: "not_supported" }
        }

        const { response } = data as { response: string }

        if (!response) {
            return { action: "not_supported" }
        }

        const saltKey = this.options_.saltKey
        const saltIndex = this.options_.saltIndex || "1"

        // Checksum = SHA256(response + saltKey) + ### + saltIndex
        const generatedSignature = crypto
            .createHash("sha256")
            .update(response + saltKey)
            .digest("hex") + "###" + saltIndex

        if (generatedSignature !== xVerify) {
            this.logger_.error("PhonePe Webhook: Invalid Signature")
            return { action: "failed" }
        }

        // 2. Decode Payload
        try {
            const buffer = Buffer.from(response, "base64")
            const decodedBody = JSON.parse(buffer.toString("utf-8"))

            const { code, data: paymentData } = decodedBody
            const merchantTransactionId = paymentData.merchantTransactionId

            if (code === "PAYMENT_SUCCESS") {
                // Return 'authorized' so Medusa completes the cart
                return {
                    action: "authorized",
                    data: {
                        session_id: merchantTransactionId,
                        amount: paymentData.amount, // Payment amount in instrument currency
                    },
                }
            } else if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") {
                return {
                    action: "failed",
                    data: {
                        session_id: merchantTransactionId,
                        amount: paymentData.amount || 0,
                    }
                }
            }
        } catch (e) {
            this.logger_.error(`PhonePe Webhook Error: ${(e as Error).message}`)
        }

        return {
            action: "not_supported",
        }
    }
}
