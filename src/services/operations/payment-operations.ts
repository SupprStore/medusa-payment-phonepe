import { BigNumber, MathBN, PaymentSessionStatus } from "@medusajs/framework/utils"
import { CreateSdkOrderRequest, MetaInfo, StandardCheckoutPayRequest } from "pg-sdk-node"
import { PhonePeOptions } from "../../types"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"

export class PaymentOperations {
    constructor(
        private clientWrapper: PhonePeClientWrapper,
        private options: PhonePeOptions
    ) { }

    async initiatePayment(input: any, callbackUrl: string) {
        const { amount, context, data, currency_code } = input
        const merchantOrderId =
            data?.merchantOrderId ||
            context?.idempotency_key ||
            context?.payment_session_data?.merchantTransactionId ||
            `MT-${Date.now()}`

        // PhonePe expects amount in paise (integers)
        const phonePeAmount = this.getSmallestUnit(amount, currency_code || "INR")
        if (phonePeAmount < 100) {
            throw new Error("PhonePe amount must be at least 100 (in paise).")
        }
        const redirectUrl = this.options.redirectUrl || callbackUrl

        const requestBuilder = StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)
            .message("Payment for Order")

        const metaInfo = this.buildMetaInfo(input)
        if (metaInfo) {
            requestBuilder.metaInfo(metaInfo)
        }

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

    async createSdkOrder(input: any, callbackUrl: string) {
        const { amount, context, data, currency_code } = input
        const merchantOrderId =
            data?.merchantOrderId ||
            context?.idempotency_key ||
            context?.payment_session_data?.merchantTransactionId ||
            `MT-${Date.now()}`

        const phonePeAmount = this.getSmallestUnit(amount, currency_code || "INR")
        if (phonePeAmount < 100) {
            throw new Error("PhonePe amount must be at least 100 (in paise).")
        }

        const redirectUrl = this.options.redirectUrl || callbackUrl
        const builder = CreateSdkOrderRequest.StandardCheckoutBuilder()
            .merchantOrderId(merchantOrderId)
            .amount(phonePeAmount)
            .redirectUrl(redirectUrl)
            .message("Payment for Order")

        const metaInfo = this.buildMetaInfo(input)
        if (metaInfo) {
            builder.metaInfo(metaInfo)
        }

        const response = await this.clientWrapper.createSdkOrder(builder.build())
        return {
            id: merchantOrderId,
            data: {
                merchantOrderId,
                sdkOrder: response
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

    private buildMetaInfo(input: any) {
        const customer = input?.context?.customer
        const data = input?.data
        const udf1 = customer?.id
        const udf2 = customer?.email
        const udf3 = customer?.phone || customer?.billing_address?.phone
        const udf4 = data?.session_id || data?.id
        const udf5 = data?.cart_id || input?.context?.idempotency_key

        const values = [udf1, udf2, udf3, udf4, udf5].filter((value) => value)
        if (values.length === 0) {
            return undefined
        }

        const builder = MetaInfo.builder()
        if (udf1) builder.udf1(String(udf1))
        if (udf2) builder.udf2(String(udf2))
        if (udf3) builder.udf3(String(udf3))
        if (udf4) builder.udf4(String(udf4))
        if (udf5) builder.udf5(String(udf5))

        return builder.build()
    }

    private getSmallestUnit(amount: any, currency: string): number {
        const multiplier = this.getCurrencyMultiplier(currency)
        let amountRounded = Math.round(new BigNumber(MathBN.mult(amount, multiplier)).numeric) / multiplier
        const smallestAmount = new BigNumber(MathBN.mult(amountRounded, multiplier))
        let numeric = smallestAmount.numeric

        if (multiplier === 1e3) {
            numeric = Math.ceil(numeric / 10) * 10
        }

        return parseInt(numeric.toString().split(".").shift(), 10)
    }

    private getCurrencyMultiplier(currency: string): number {
        const currencyMultipliers: Record<number, string[]> = {
            0: [
                "BIF",
                "CLP",
                "DJF",
                "GNF",
                "JPY",
                "KMF",
                "KRW",
                "MGA",
                "PYG",
                "RWF",
                "UGX",
                "VND",
                "VUV",
                "XAF",
                "XOF",
                "XPF",
            ],
            3: ["BHD", "IQD", "JOD", "KWD", "OMR", "TND"],
        }

        const normalized = currency.toUpperCase()
        let power = 2
        for (const [key, value] of Object.entries(currencyMultipliers)) {
            if (value.includes(normalized)) {
                power = parseInt(key, 10)
                break
            }
        }
        return Math.pow(10, power)
    }
}
