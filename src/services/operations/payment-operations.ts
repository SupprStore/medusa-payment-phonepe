import { PaymentSessionStatus } from "@medusajs/framework/utils"
import { CreateSdkOrderRequest, StandardCheckoutPayRequest } from "pg-sdk-node"
import { PhonePeOptions } from "../../types"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"
import { assertPhonePeCurrency, toPhonePeAmount } from "../utils/currency"

export class PaymentOperations {
    constructor(
        private clientWrapper: PhonePeClientWrapper,
        private options: PhonePeOptions
    ) { }

    // Shared by initiatePayment and createSdkOrder: both key an order off the Medusa
    // payment session id and need the same currency/amount validation.
    private prepareOrder(input: any): { sessionId: string; phonePeAmount: number } {
        const { amount, currency_code, data } = input
        const sessionId = data?.session_id as string | undefined

        if (!sessionId) {
            throw new Error("PhonePe: missing Medusa payment session id (data.session_id)")
        }

        assertPhonePeCurrency(currency_code)
        return { sessionId, phonePeAmount: toPhonePeAmount(amount) }
    }

    async initiatePayment(input: any, callbackUrl: string) {
        const { sessionId, phonePeAmount } = this.prepareOrder(input)
        const redirectUrl = this.options.redirectUrl || callbackUrl

        const requestBuilder = StandardCheckoutPayRequest.builder()
            .merchantOrderId(sessionId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)

        const payload = requestBuilder.build()
        const response = await this.clientWrapper.pay(payload)

        return {
            id: sessionId,
            data: {
                ...input.data,
                session_id: sessionId,
                redirectUrl: response.redirectUrl,
            },
        }
    }

    // For native mobile apps using PhonePe's mobile SDK: not part of Medusa's IPaymentProvider
    // interface, called directly by a consumer's own custom API route.
    async createSdkOrder(input: any) {
        const { sessionId, phonePeAmount } = this.prepareOrder(input)
        const redirectUrl = this.options.redirectUrl

        const requestBuilder = CreateSdkOrderRequest.StandardCheckoutBuilder()
            .merchantOrderId(sessionId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)

        const response = await this.clientWrapper.createSdkOrder(requestBuilder.build())

        return {
            token: response.token,
            orderId: response.orderId,
        }
    }

    async authorizePayment(input: any) {
        const sessionId = input.data?.session_id as string

        try {
            const statusResponse = await this.clientWrapper.getOrderStatus(sessionId)

            if (statusResponse.state === "COMPLETED") {
                return {
                    status: PaymentSessionStatus.AUTHORIZED,
                    data: {
                        ...input.data,
                        paymentId: statusResponse.orderId || statusResponse.merchantOrderId,
                    },
                }
            }

            if (statusResponse.state === "PENDING") {
                return {
                    status: PaymentSessionStatus.PENDING,
                    data: input.data,
                }
            }

            return {
                status: PaymentSessionStatus.ERROR,
                data: {
                    ...input.data,
                    error: statusResponse.state || "Payment failed",
                },
            }
        } catch (error: any) {
            return {
                status: PaymentSessionStatus.ERROR,
                data: {
                    ...input.data,
                    error: error.message,
                },
            }
        }
    }

    async getPaymentStatus(input: any) {
        const sessionId = input.data?.session_id as string

        try {
            const statusResponse = await this.clientWrapper.getOrderStatus(sessionId)
            if (statusResponse.state === "COMPLETED") {
                return { status: PaymentSessionStatus.AUTHORIZED, data: input.data }
            }
            if (statusResponse.state === "PENDING") {
                return { status: PaymentSessionStatus.PENDING, data: input.data }
            }
            return { status: PaymentSessionStatus.ERROR, data: input.data }
        } catch (e) {
            return { status: PaymentSessionStatus.ERROR, data: input.data }
        }
    }

    async retrievePayment(input: any) {
        const sessionId = input.data?.session_id as string
        const statusResponse = await this.clientWrapper.getOrderStatus(sessionId)

        return {
            data: {
                ...input.data,
                state: statusResponse.state,
                paymentId: statusResponse.orderId || statusResponse.merchantOrderId,
            },
        }
    }
}
