import { PaymentSessionStatus } from "@medusajs/framework/utils"
import { StandardCheckoutPayRequest } from "pg-sdk-node"
import { PhonePeOptions } from "../../types"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"

export class PaymentOperations {
    constructor(
        private clientWrapper: PhonePeClientWrapper,
        private options: PhonePeOptions
    ) { }

    async initiatePayment(input: any, callbackUrl: string) {
        const { amount, context } = input

        const merchantTransactionId = context?.payment_session_data?.merchantTransactionId || `MT${Date.now()}`
        // PhonePe expects amount in paise (integers)
        const phonePeAmount = Math.round(amount)
        const redirectUrl = this.options.redirectUrl || callbackUrl

        const requestBuilder = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantTransactionId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)
            .message("Payment for Order")

        const payload = requestBuilder.build()
        const response = await this.clientWrapper.pay(payload)

        return {
            id: merchantTransactionId, // Medusa needs an ID
            redirectUrl: response.redirectUrl,
            merchantTransactionId
        }
    }

    async authorizePayment(paymentSessionData: any) {
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string

        try {
            const statusResponse = await this.clientWrapper.getOrderStatus(merchantTransactionId)

            if (statusResponse.state === "COMPLETED") {
                return {
                    status: PaymentSessionStatus.AUTHORIZED,
                    data: {
                        ...paymentSessionData,
                        paymentId: statusResponse.orderId || statusResponse.merchantOrderId
                    }
                }
            }

            if (statusResponse.state === "PENDING" || statusResponse.state === "On Progress") {
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

    async getPaymentStatus(paymentSessionData: any) {
        const merchantTransactionId = paymentSessionData.merchantTransactionId as string

        try {
            const statusResponse = await this.clientWrapper.getOrderStatus(merchantTransactionId)
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
}
