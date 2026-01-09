import {
    AbstractPaymentProvider,
    PaymentSessionStatus
} from "@medusajs/framework/utils"
import {
    Logger,
    ProviderWebhookPayload,
    WebhookActionResult
} from "@medusajs/types"
import crypto from "crypto"
import axios from "axios"
import {
    PhonePeOptions,
    PhonePeInitiateRequest,
    PhonePeResponse,
    PhonePeRefundRequest
} from "../types"

export class PhonePeProvider extends AbstractPaymentProvider<PhonePeOptions> {
    static identifier = "phonepe"
    protected options_: PhonePeOptions
    protected logger_: Logger

    constructor(container: { logger: Logger }, options: PhonePeOptions) {
        super(container, options)
        this.options_ = options
        this.logger_ = container.logger
    }

    get baseUrl() {
        return this.options_.mode === "prod"
            ? "https://api.phonepe.com/apis/hermes"
            : "https://api-preprod.phonepe.com/apis/pg-sandbox"
    }

    async initiatePayment(input: any): Promise<any> {
        const { amount, currency_code, context } = input

        // PhonePe expects amount in paise (integers)
        // Ensure amount is an integer
        const phonePeAmount = Math.round(amount)

        const merchantTransactionId = context?.payment_session_data?.merchantTransactionId || `MT${Date.now()}`
        const merchantUserId = context?.customer?.id || "guest"

        const callbackUrl = this.options_.callbackUrl || `${context.context?.origin || ""}/phonepe/callback`

        // Construct payload
        const payload: PhonePeInitiateRequest = {
            merchantId: this.options_.merchantId,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: merchantUserId,
            amount: phonePeAmount,
            redirectUrl: this.options_.redirectUrl,
            redirectMode: this.options_.redirectMode || "POST",
            callbackUrl: callbackUrl,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        }

        if (context?.customer?.phone) {
            payload.mobileNumber = context.customer.phone
        }

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
        const apiPath = "/pg/v1/pay"
        const checksum = this.generateChecksum(base64Payload, apiPath)

        try {
            const response = await axios.post(
                `${this.baseUrl}${apiPath}`,
                { request: base64Payload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-VERIFY": checksum
                    }
                }
            )

            const data = response.data as PhonePeResponse

            if (data.success) {
                return {
                    ...data,
                    merchantTransactionId
                }
            } else {
                throw new Error(data.message || "PhonePe initialization failed")
            }
        } catch (error: any) {
            this.logger_.error(`PhonePe initiation failed: ${error.message}`)
            throw error
        }
    }

    async authorizePayment(input: any): Promise<any> {
        // In Medusa v2, input is usually the session data directly or contains it.
        const paymentSessionData = input
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string

        const statusData = await this.checkPaymentStatus(merchantTransactionId)

        if (statusData.success && statusData.code === "PAYMENT_SUCCESS") {
            return {
                status: PaymentSessionStatus.AUTHORIZED,
                data: {
                    ...paymentSessionData,
                    paymentId: statusData.data.paymentId
                }
            }
        }

        if (statusData.code === "PAYMENT_PENDING") {
            return {
                status: PaymentSessionStatus.PENDING,
                data: paymentSessionData
            }
        }

        return {
            status: PaymentSessionStatus.ERROR,
            data: {
                ...paymentSessionData,
                error: statusData.message || "Payment failed or validation failed"
            }
        }
    }

    async cancelPayment(input: any): Promise<any> {
        return input
    }

    async capturePayment(input: any): Promise<any> {
        // Assuming Auto-Capture is enabled on PhonePe dashboard for PAY_PAGE
        return {
            ...input,
            status: "captured"
        }
    }

    async refundPayment(input: any): Promise<any> {
        // input contains { data: ..., amount: ... } usually
        const paymentSessionData = input.data || input
        const refundAmount = input.amount

        const merchantTransactionId = `REF-${Date.now()}` // New Transaction ID for Refund
        const originalTransactionId = paymentSessionData.merchantTransactionId as string
        const amount = Math.round(refundAmount)

        const payload: PhonePeRefundRequest = {
            merchantId: this.options_.merchantId,
            merchantUserId: (paymentSessionData.merchantUserId as string) || "guest",
            originalTransactionId: originalTransactionId,
            merchantTransactionId: merchantTransactionId,
            amount: amount,
            callbackUrl: this.options_.callbackUrl
        }

        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64")
        const apiPath = "/pg/v1/refund"
        const checksum = this.generateChecksum(base64Payload, apiPath)

        try {
            const response = await axios.post(
                `${this.baseUrl}${apiPath}`,
                { request: base64Payload },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-VERIFY": checksum
                    }
                }
            )
            const data = response.data as PhonePeResponse

            if (data.success) {
                return {
                    ...paymentSessionData,
                    refundParams: data.data
                }
            } else {
                this.logger_.error(`PhonePe Refund Failed: ${data.message}`)
                throw new Error(data.message || "Refund failed")
            }

        } catch (error: any) {
            this.logger_.error(`PhonePe Refund Error: ${error.message}`)
            throw error
        }
    }

    async getPaymentStatus(input: any): Promise<any> {
        const paymentSessionData = input
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string
        const statusData = await this.checkPaymentStatus(merchantTransactionId)

        if (statusData.success && statusData.code === "PAYMENT_SUCCESS") {
            return { status: PaymentSessionStatus.AUTHORIZED }
        }
        if (statusData.code === "PAYMENT_PENDING") {
            return { status: PaymentSessionStatus.PENDING }
        }
        return { status: PaymentSessionStatus.ERROR }
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
        data: ProviderWebhookPayload["payload"]
    ): Promise<WebhookActionResult> {
        const payload = data as any

        const rawBody = payload.response as string
        const receivedChecksum = payload.headers?.["x-verify"]

        if (!rawBody) {
            return {
                action: "not_supported",
            }
        }

        if (receivedChecksum) {
            const stringToHash = rawBody + this.options_.saltKey
            const calculatedChecksum = crypto.createHash("sha256").update(stringToHash).digest("hex") + "###" + this.options_.saltIndex

            if (calculatedChecksum !== receivedChecksum) {
                this.logger_.error("PhonePe Webhook Signature Verification Failed")
                return {
                    action: "not_supported",
                }
            }
        }


        const decodedData = JSON.parse(Buffer.from(rawBody, "base64").toString("utf-8")) as PhonePeResponse

        if (decodedData.code === "PAYMENT_SUCCESS") {
            // TODO: To support captured action, we need to return { session_id, amount }.
            // We currently don't have a reliable way to map merchantTransactionId back to session_id 
            // without query access or reliable metadata round-trip which PhonePe doesn't always guarantee in this payload.
            // For now, we will verify signature and let normal redirect authorization handle state.

            return {
                action: "not_supported",
            }
        }

        return {
            action: "not_supported"
        }
    }

    protected generateChecksum(base64Payload: string, apiPath: string) {
        const stringToHash = base64Payload + apiPath + this.options_.saltKey
        const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex")
        return `${sha256}###${this.options_.saltIndex}`
    }

    protected async checkPaymentStatus(merchantTransactionId: string) {
        const apiPath = `/pg/v1/status/${this.options_.merchantId}/${merchantTransactionId}`
        const stringToHash = apiPath + this.options_.saltKey
        const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex")
        const checksum = `${sha256}###${this.options_.saltIndex}`

        try {
            const response = await axios.get(
                `${this.baseUrl}${apiPath}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-VERIFY": checksum,
                        "X-MERCHANT-ID": this.options_.merchantId
                    }
                }
            )
            return response.data as PhonePeResponse
        } catch (e) {
            this.logger_.error("Error fetching status from PhonePe")
            return { success: false, code: "ERROR", message: "Failed to fetch status", data: {} } as PhonePeResponse
        }
    }
}
