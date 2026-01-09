import {
    AbstractPaymentProvider,
    PaymentSessionStatus
} from "@medusajs/framework/utils"
import {
    Logger
} from "@medusajs/types"
import crypto from "crypto"
import axios from "axios"

type PhonePeOptions = {
    merchantId: string
    saltKey: string
    saltIndex: string
    redirectUrl: string
    callbackUrl: string
    mode: "uat" | "prod"
}

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
        const merchantTransactionId = context?.payment_session_data?.merchantTransactionId || `MT${Date.now()}`

        // Construct payload
        const payload = {
            merchantId: this.options_.merchantId,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: context?.customer?.id || "guest",
            amount: amount,
            redirectUrl: this.options_.redirectUrl,
            redirectMode: "POST",
            callbackUrl: this.options_.callbackUrl,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
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

            const data = response.data

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
            throw error // Or return error generic object
        }
    }

    async authorizePayment(input: any): Promise<any> {
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
                error: "Payment failed or validation failed"
            }
        }
    }

    async cancelPayment(input: any): Promise<any> {
        return input
    }

    async capturePayment(input: any): Promise<any> {
        return {
            ...input,
            status: "captured"
        }
    }

    async refundPayment(input: any): Promise<any> {
        const { data: paymentSessionData, amount } = input
        // Implement refund API call if needed
        return paymentSessionData
    }

    async getPaymentStatus(input: any): Promise<any> {
        const paymentSessionData = input
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string
        const statusData = await this.checkPaymentStatus(merchantTransactionId)

        if (statusData.success && statusData.code === "PAYMENT_SUCCESS") {
            return PaymentSessionStatus.AUTHORIZED
        }
        if (statusData.code === "PAYMENT_PENDING") {
            return PaymentSessionStatus.PENDING
        }
        return PaymentSessionStatus.ERROR
    }

    async deletePayment(input: any): Promise<any> {
        return input
    }

    async retrievePayment(input: any): Promise<any> {
        return input
    }

    async updatePayment(input: any): Promise<any> {
        // Re-initiate or update logic can go here. 
        return this.initiatePayment(input)
    }

    async getWebhookActionAndData(input: any): Promise<any> {
        return {
            action: "not_supported",
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
            return response.data
        } catch (e) {
            this.logger_.error("Error fetching status from PhonePe")
            return { success: false, code: "ERROR" }
        }
    }
}
