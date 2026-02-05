import { BigNumber, MathBN } from "@medusajs/framework/utils"
import { RefundRequest } from "pg-sdk-node"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"

export class RefundOperations {
    constructor(private clientWrapper: PhonePeClientWrapper) { }

    async refundPayment(input: any) {
        const paymentSessionData = input.data || {}
        const refundAmount = input.amount
        const currency = input.currency_code || paymentSessionData.currency_code || "INR"
        const amount = this.getSmallestUnit(refundAmount, currency)

        if (amount <= 0) {
            throw new Error("Refund amount must be greater than zero.")
        }

        const merchantRefundId =
            paymentSessionData.merchantRefundId ||
            input.context?.idempotency_key ||
            `REF-${paymentSessionData.merchantOrderId || paymentSessionData.merchantTransactionId || Date.now()}`

        const originalTransactionId =
            paymentSessionData.merchantOrderId ||
            paymentSessionData.merchantTransactionId as string

        if (!originalTransactionId) {
            throw new Error("Missing merchantOrderId for refund.")
        }

        const refundBuilder = RefundRequest.builder()
            .merchantRefundId(merchantRefundId)
            .amount(amount)
            .originalMerchantOrderId(originalTransactionId)

        const response = await this.clientWrapper.refund(refundBuilder.build())

        if (["FAILED", "DECLINED", "ERROR"].includes(response.state)) {
            throw new Error(`Refund state: ${response.state}`)
        }

        return {
            data: {
                ...paymentSessionData,
                merchantRefundId,
                refundResponse: response
            }
        }
    }

    async getRefundStatus(refundId: string) {
        return this.clientWrapper.getRefundStatus(refundId)
    }

    private getSmallestUnit(amount: any, currency: string): number {
        const multiplier = this.getCurrencyMultiplier(currency)
        let amountRounded = Math.round(new BigNumber(MathBN.mult(amount, multiplier)).numeric) / multiplier
        const smallestAmount = new BigNumber(MathBN.mult(amountRounded, multiplier))
        let numeric = smallestAmount.numeric

        if (multiplier === 1e3) {
            numeric = Math.ceil(numeric / 10) * 10
        }

        const [whole = "0"] = numeric.toString().split(".")
        return parseInt(whole, 10)
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
