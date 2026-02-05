import { ProviderWebhookPayload, WebhookActionResult } from "@medusajs/types"
import * as crypto from "crypto"
import { PhonePeOptions } from "../../types"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"

export class WebhookValidator {
    constructor(
        private options: PhonePeOptions,
        private clientWrapper: PhonePeClientWrapper
    ) { }

    async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
        const { data, headers, rawData } = payload

        const authorization = (headers["authorization"] || headers["Authorization"]) as string | undefined
        const username = this.options.callbackUsername
        const password = this.options.callbackPassword
        const verifyWithApi = this.options.webhookVerifyWithApi ?? true

        if (authorization && (!username || !password)) {
            return { action: "failed" }
        }

        if (authorization && username && password) {
            try {
                const rawBody =
                    typeof rawData === "string" ? rawData : rawData ? rawData.toString("utf-8") : JSON.stringify(data)

                const callback = this.clientWrapper.validateCallback(
                    username,
                    password,
                    authorization,
                    rawBody
                )

                const state = callback?.payload?.state
                const merchantOrderId = callback?.payload?.merchantOrderId
                const amount = callback?.payload?.amount

                if (!merchantOrderId) {
                    return { action: "not_supported" }
                }

                if (verifyWithApi) {
                    const isValid = await this.verifyOrderWithApi(merchantOrderId, amount)
                    if (!isValid) {
                        return { action: "failed" }
                    }
                }

                switch (state) {
                    case "COMPLETED":
                        return {
                            action: "authorized",
                            data: { session_id: merchantOrderId, amount }
                        }
                    case "PENDING":
                        return {
                            action: "pending",
                            data: { session_id: merchantOrderId, amount }
                        }
                    case "CANCELLED":
                    case "CANCELED":
                        return {
                            action: "canceled",
                            data: { session_id: merchantOrderId, amount }
                        }
                    case "FAILED":
                    case "DECLINED":
                    case "EXPIRED":
                        return {
                            action: "failed",
                            data: { session_id: merchantOrderId, amount: amount || 0 }
                        }
                    default:
                        return { action: "not_supported" }
                }
            } catch (e) {
                return { action: "failed" }
            }
        }

        // Legacy checksum verification (x-verify)
        const xVerify = headers["x-verify"] as string | undefined
        if (!xVerify) {
            return { action: "not_supported" }
        }

        const { response } = data as { response: string }
        if (!response) {
            return { action: "not_supported" }
        }

        const saltKey = this.options.saltKey
        const saltIndex = this.options.saltIndex || "1"

        if (!saltKey) {
            return { action: "not_supported" }
        }

        // Checksum = SHA256(response + saltKey) + ### + saltIndex
        const generatedSignature = crypto
            .createHash("sha256")
            .update(response + saltKey)
            .digest("hex") + "###" + saltIndex

        if (generatedSignature !== xVerify) {
            return { action: "failed" }
        }

        try {
            const buffer = Buffer.from(response, "base64")
            const decodedBody = JSON.parse(buffer.toString("utf-8"))

            const { code, data: paymentData } = decodedBody
            const merchantTransactionId = paymentData.merchantTransactionId
            const amount = paymentData.amount

            if (verifyWithApi) {
                const isValid = await this.verifyOrderWithApi(merchantTransactionId, amount)
                if (!isValid) {
                    return { action: "failed" }
                }
            }

            if (code === "PAYMENT_SUCCESS") {
                return {
                    action: "authorized",
                    data: {
                        session_id: merchantTransactionId,
                        amount,
                    },
                }
            } else if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") {
                return {
                    action: "failed",
                    data: {
                        session_id: merchantTransactionId,
                        amount: amount || 0,
                    }
                }
            }
        } catch (e) {
            return { action: "not_supported" }
        }

        return { action: "not_supported" }
    }

    private async verifyOrderWithApi(merchantOrderId: string, amount?: number): Promise<boolean> {
        try {
            const status = await this.clientWrapper.getOrderStatus(merchantOrderId)

            if (status?.merchantOrderId && status.merchantOrderId !== merchantOrderId) {
                return false
            }

            if (typeof amount === "number" && status?.amount !== undefined && status.amount !== amount) {
                return false
            }

            return true
        } catch (e) {
            return false
        }
    }
}
