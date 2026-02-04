import { RefundRequest } from "pg-sdk-node"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"

export class RefundOperations {
    constructor(private clientWrapper: PhonePeClientWrapper) { }

    async refundPayment(input: any) {
        const paymentSessionData = input.data || input
        const refundAmount = input.amount
        const amount = Math.round(refundAmount)

        const merchantTransactionId = `REF-${Date.now()}`
        const originalTransactionId = paymentSessionData.merchantTransactionId as string

        const refundBuilder = RefundRequest.builder()
            .merchantRefundId(merchantTransactionId)
            .amount(amount)
            .originalMerchantOrderId(originalTransactionId)

        const response = await this.clientWrapper.refund(refundBuilder.build())

        if (response.state === "COMPLETED" || response.state === "SUCCESS" || response.state === "PAYMENT_SUCCESS") {
            return {
                ...paymentSessionData,
                refundParams: response
            }
        } else {
            throw new Error(`Refund state: ${response.state}`)
        }
    }
}
