import { RefundRequest } from "pg-sdk-node"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"
import { toPhonePeAmount } from "../utils/currency"

export class RefundOperations {
    constructor(private clientWrapper: PhonePeClientWrapper) { }

    async refundPayment(input: any) {
        const paymentData = input.data || input
        const sessionId = paymentData.session_id as string
        const amount = toPhonePeAmount(input.amount)

        const merchantRefundId = `REF-${sessionId}-${Date.now()}`

        const refundBuilder = RefundRequest.builder()
            .merchantRefundId(merchantRefundId)
            .amount(amount)
            .originalMerchantOrderId(sessionId)

        const response = await this.clientWrapper.refund(refundBuilder.build())

        // Refunds are processed asynchronously by PhonePe; only a "FAILED" state here is a
        // hard failure. Anything else (PENDING/CONFIRMED/COMPLETED) should reconcile via
        // getRefundStatus.
        if (response.state === "FAILED") {
            throw new Error(`Refund state: ${response.state}`)
        }

        return {
            data: {
                ...paymentData,
                refundId: response.refundId,
                refundState: response.state,
            },
        }
    }

    async getRefundStatus(refundId: string) {
        return this.clientWrapper.getRefundStatus(refundId)
    }
}
