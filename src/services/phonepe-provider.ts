import {
    AbstractPaymentProvider,
    PaymentSessionStatus
} from "@medusajs/framework/utils"
import {
    Logger,
    ProviderWebhookPayload,
    WebhookActionResult
} from "@medusajs/types"
import { PhonePeOptions } from "../types"
import { PhonePeClientWrapper } from "./phonepe-client-wrapper"
import { PaymentOperations } from "./operations/payment-operations"
import { RefundOperations } from "./operations/refund-operations"
import { WebhookValidator } from "./validators/webhook-validator"

export class PhonePeProvider extends AbstractPaymentProvider<PhonePeOptions> {
    static identifier = "phonepe"
    protected options_: PhonePeOptions
    protected logger_: Logger
    protected clientWrapper_: PhonePeClientWrapper
    protected paymentOperations_: PaymentOperations
    protected refundOperations_: RefundOperations
    protected webhookValidator_: WebhookValidator

    constructor(container: { logger: Logger }, options: PhonePeOptions) {
        super(container, options)
        this.options_ = options
        this.logger_ = container.logger

        // Initialize Services
        this.clientWrapper_ = new PhonePeClientWrapper(this.options_)
        this.paymentOperations_ = new PaymentOperations(this.clientWrapper_, this.options_)
        this.refundOperations_ = new RefundOperations(this.clientWrapper_)
        this.webhookValidator_ = new WebhookValidator(this.options_)
    }

    async initiatePayment(input: any): Promise<any> {
        const callbackUrl = this.options_.callbackUrl || `${input.context?.context?.origin || ""}/phonepe/callback`
        try {
            return await this.paymentOperations_.initiatePayment(input, callbackUrl)
        } catch (error: any) {
            this.logger_.error(`PhonePe initiation failed: ${error.message}`)
            throw error
        }
    }

    async authorizePayment(input: any): Promise<any> {
        return await this.paymentOperations_.authorizePayment(input)
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
        try {
            return await this.refundOperations_.refundPayment(input)
        } catch (error: any) {
            this.logger_.error(`PhonePe Refund Error: ${error.message}`)
            throw error
        }
    }

    async getPaymentStatus(input: any): Promise<any> {
        return await this.paymentOperations_.getPaymentStatus(input)
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
        try {
            const result = await this.webhookValidator_.getWebhookActionAndData(payload)
            if (result.action === "failed") {
                this.logger_.error("PhonePe Webhook: Verification Failed or Payment Failed")
            }
            return result
        } catch (e: any) {
            this.logger_.error(`PhonePe Webhook Error: ${e.message}`)
            return { action: "not_supported" }
        }
    }
}
