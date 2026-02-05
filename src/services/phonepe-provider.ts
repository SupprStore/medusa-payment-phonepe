import {
    AbstractPaymentProvider
} from "@medusajs/framework/utils"
import {
    Logger,
    InitiatePaymentInput,
    InitiatePaymentOutput,
    AuthorizePaymentInput,
    AuthorizePaymentOutput,
    CancelPaymentInput,
    CancelPaymentOutput,
    CapturePaymentInput,
    CapturePaymentOutput,
    RefundPaymentInput,
    RefundPaymentOutput,
    GetPaymentStatusInput,
    GetPaymentStatusOutput,
    DeletePaymentInput,
    DeletePaymentOutput,
    RetrievePaymentInput,
    RetrievePaymentOutput,
    UpdatePaymentInput,
    UpdatePaymentOutput,
    ProviderWebhookPayload,
    WebhookActionResult
} from "@medusajs/types"
import { PhonePeOptions } from "../types"
import { PhonePeClientWrapper } from "./phonepe-client-wrapper"
import { PaymentOperations } from "./operations/payment-operations"
import { RefundOperations } from "./operations/refund-operations"
import { ReconciliationOperations } from "./operations/reconciliation-operations"
import { WebhookValidator } from "./validators/webhook-validator"

export class PhonePeProvider extends AbstractPaymentProvider<PhonePeOptions> {
    static identifier = "phonepe"
    protected options_: PhonePeOptions
    protected logger_: Logger
    protected clientWrapper_: PhonePeClientWrapper
    protected paymentOperations_: PaymentOperations
    protected refundOperations_: RefundOperations
    protected reconciliationOperations_: ReconciliationOperations
    protected webhookValidator_: WebhookValidator

    constructor(container: { logger: Logger }, options: PhonePeOptions) {
        super(container, options)
        this.options_ = options
        this.logger_ = container.logger

        // Initialize Services
        this.clientWrapper_ = new PhonePeClientWrapper(this.options_)
        this.paymentOperations_ = new PaymentOperations(this.clientWrapper_, this.options_)
        this.refundOperations_ = new RefundOperations(this.clientWrapper_)
        this.reconciliationOperations_ = new ReconciliationOperations(this.clientWrapper_)
        this.webhookValidator_ = new WebhookValidator(this.options_, this.clientWrapper_)

        if (!this.options_.clientId && this.options_.merchantId) {
            this.logger_.warn("PhonePe: using legacy merchantId/saltKey/saltIndex. Prefer clientId/clientSecret/clientVersion.")
        }
    }

    async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
        const origin = (input as any)?.context?.context?.origin || ""
        const callbackUrl = this.options_.callbackUrl || (origin ? `${origin}/phonepe/callback` : "")
        if (!callbackUrl) {
            throw new Error("Missing callbackUrl. Configure callbackUrl or provide context.origin.")
        }
        try {
            return await this.paymentOperations_.initiatePayment(input, callbackUrl)
        } catch (error: any) {
            this.logger_.error(`PhonePe initiation failed: ${error.message}`)
            throw error
        }
    }

    // Not part of the Medusa payment provider interface, but exposed for mobile SDK flows.
    async createSdkOrder(input: InitiatePaymentInput): Promise<any> {
        const origin = (input as any)?.context?.context?.origin || ""
        const callbackUrl = this.options_.callbackUrl || (origin ? `${origin}/phonepe/callback` : "")
        if (!callbackUrl) {
            throw new Error("Missing callbackUrl. Configure callbackUrl or provide context.origin.")
        }
        try {
            return await this.paymentOperations_.createSdkOrder(input, callbackUrl)
        } catch (error: any) {
            this.logger_.error(`PhonePe SDK order creation failed: ${error.message}`)
            throw error
        }
    }

    async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
        return await this.paymentOperations_.authorizePayment(input)
    }

    async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
        this.logger_.warn("PhonePe does not support canceling payments via API. Returning current data.")
        return { data: input?.data ?? {} }
    }

    async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
        // PhonePe 'pay' is usually auto-captured.
        this.logger_.info("PhonePe captures payments automatically. Returning current data.")
        return { data: input?.data ?? {} }
    }

    async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
        try {
            return await this.refundOperations_.refundPayment(input)
        } catch (error: any) {
            this.logger_.error(`PhonePe Refund Error: ${error.message}`)
            throw error
        }
    }

    // Not part of the Medusa payment provider interface, but exposed for integrations that need refund reconciliation.
    async getRefundStatus(refundId: string): Promise<any> {
        const status = await this.refundOperations_.getRefundStatus(refundId)
        return { data: { refundStatus: status } }
    }

    async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
        return await this.paymentOperations_.getPaymentStatus(input)
    }

    async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
        return await this.cancelPayment(input)
    }

    async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
        return await this.paymentOperations_.retrievePayment(input)
    }

    async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
        if (input?.data?.merchantOrderId || input?.data?.id) {
            return { data: input.data }
        }

        const initiated = await this.initiatePayment(input)
        return {
            status: initiated.status,
            data: initiated.data ?? { merchantOrderId: initiated.id }
        }
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

    // Reconciliation helpers (not part of Medusa provider interface)
    async reconcilePayments(merchantOrderIds: string[]) {
        return this.reconciliationOperations_.reconcilePayments(merchantOrderIds)
    }

    async reconcileRefunds(refundIds: string[]) {
        return this.reconciliationOperations_.reconcileRefunds(refundIds)
    }
}
