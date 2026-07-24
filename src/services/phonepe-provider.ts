import {
    AbstractPaymentProvider,
    PaymentSessionStatus
} from "@medusajs/framework/utils"
import {
    Logger,
    ProviderWebhookPayload,
    WebhookActionResult
} from "@medusajs/types"
import { PhonePeException } from "pg-sdk-node"
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
        this.webhookValidator_ = new WebhookValidator(this.clientWrapper_, this.options_)
    }

    private logError(message: string, error: any): void {
        if (error instanceof PhonePeException) {
            this.logger_.error(
                `${message}: ${error.message} (type=${error.type}, code=${error.code}, httpStatusCode=${error.httpStatusCode})`
            )
            return
        }
        this.logger_.error(`${message}: ${error.message}`)
    }

    async initiatePayment(input: any): Promise<any> {
        try {
            return await this.paymentOperations_.initiatePayment(input, this.options_.callbackUrl || "")
        } catch (error: any) {
            this.logError("PhonePe initiation failed", error)
            throw error
        }
    }

    async createSdkOrder(input: any): Promise<any> {
        try {
            return await this.paymentOperations_.createSdkOrder(input)
        } catch (error: any) {
            this.logError("PhonePe createSdkOrder failed", error)
            throw error
        }
    }

    async authorizePayment(input: any): Promise<any> {
        return await this.paymentOperations_.authorizePayment(input)
    }

    async cancelPayment(input: any): Promise<any> {
        // PhonePe's SDK has no cancel/void endpoint; nothing to do beyond acknowledging.
        return { data: input.data }
    }

    async capturePayment(input: any): Promise<any> {
        // PhonePe 'pay' is auto-captured; no separate capture call exists.
        return { data: input.data }
    }

    async refundPayment(input: any): Promise<any> {
        try {
            return await this.refundOperations_.refundPayment(input)
        } catch (error: any) {
            this.logError("PhonePe refund failed", error)
            throw error
        }
    }

    async getPaymentStatus(input: any): Promise<any> {
        return await this.paymentOperations_.getPaymentStatus(input)
    }

    async deletePayment(input: any): Promise<any> {
        // PhonePe's SDK has no delete endpoint; nothing to do beyond acknowledging.
        return { data: input.data }
    }

    async retrievePayment(input: any): Promise<any> {
        return await this.paymentOperations_.retrievePayment(input)
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
