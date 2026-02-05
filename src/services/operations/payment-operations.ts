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
        const { amount, context, data } = input
        const merchantOrderId =
            data?.merchantOrderId ||
            context?.idempotency_key ||
            context?.payment_session_data?.merchantTransactionId ||
            `MT-${Date.now()}`

        // PhonePe expects amount in paise (integers)
        const phonePeAmount = Math.round(Number(amount))
        const redirectUrl = this.options.redirectUrl || callbackUrl

        const requestBuilder = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)
            .message("Payment for Order")

        const payload = requestBuilder.build()
        const response = await this.clientWrapper.pay(payload)

        return {
            id: merchantOrderId, // Medusa needs an ID
            data: {
                merchantOrderId,
                redirectUrl: response.redirectUrl,
            }
        }
    }

    async authorizePayment(paymentSessionData: any) {
        const merchantOrderId = this.getMerchantOrderId(paymentSessionData)

        try {
            if (!merchantOrderId) {
                return {
                    status: PaymentSessionStatus.ERROR,
                    data: {
                        ...paymentSessionData,
                        error: "Missing merchantOrderId for authorization"
                    }
                }
            }

            const statusResponse = await this.clientWrapper.getOrderStatus(merchantOrderId)
            const status = this.mapOrderStatus(statusResponse.state)

            return {
                status,
                data: {
                    ...paymentSessionData,
                    merchantOrderId,
                    paymentId: statusResponse.orderId || statusResponse.merchantOrderId,
                    state: statusResponse.state,
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
        const merchantOrderId = this.getMerchantOrderId(paymentSessionData)

        try {
            if (!merchantOrderId) {
                return { status: PaymentSessionStatus.ERROR }
            }

            const statusResponse = await this.clientWrapper.getOrderStatus(merchantOrderId)
            return { status: this.mapOrderStatus(statusResponse.state) }
        } catch (e) {
            return { status: PaymentSessionStatus.ERROR }
        }
    }

    async retrievePayment(input: any) {
        const merchantOrderId = this.getMerchantOrderId(input)

        if (!merchantOrderId) {
            return { data: input?.data ?? {} }
        }

        const statusResponse = await this.clientWrapper.getOrderStatus(merchantOrderId)
        return {
            data: {
                merchantOrderId,
                state: statusResponse.state,
                amount: statusResponse.amount,
                orderId: statusResponse.orderId,
                response: statusResponse,
            }
        }
    }

    private getMerchantOrderId(input: any): string | undefined {
        return (
            input?.merchantOrderId ||
            input?.data?.merchantOrderId ||
            input?.data?.id ||
            input?.merchantTransactionId ||
            input?.data?.merchantTransactionId
        )
    }

    private mapOrderStatus(state?: string) {
        switch (state) {
            case "COMPLETED":
                return PaymentSessionStatus.AUTHORIZED
            case "PENDING":
                return PaymentSessionStatus.PENDING
            case "FAILED":
            case "DECLINED":
            case "CANCELLED":
            case "CANCELED":
                return PaymentSessionStatus.CANCELED
            case "EXPIRED":
                return PaymentSessionStatus.ERROR
            default:
                return PaymentSessionStatus.ERROR
        }
    }
}
