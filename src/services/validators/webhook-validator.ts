import { ProviderWebhookPayload, WebhookActionResult } from "@medusajs/types"
import * as crypto from "crypto"
import { PhonePeOptions } from "../../types"

export class WebhookValidator {
    constructor(private options: PhonePeOptions) { }

    async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
        const { data, headers } = payload

        // 1. Verify Signature
        const xVerify = headers["x-verify"]
        if (!xVerify) {
            return { action: "not_supported" }
        }

        const { response } = data as { response: string }

        if (!response) {
            return { action: "not_supported" }
        }

        const saltKey = this.options.saltKey
        const saltIndex = this.options.saltIndex || "1"

        // Checksum = SHA256(response + saltKey) + ### + saltIndex
        const generatedSignature = crypto
            .createHash("sha256")
            .update(response + saltKey)
            .digest("hex") + "###" + saltIndex

        if (generatedSignature !== xVerify) {
            return { action: "failed" }
        }

        // 2. Decode Payload
        try {
            const buffer = Buffer.from(response, "base64")
            const decodedBody = JSON.parse(buffer.toString("utf-8"))

            const { code, data: paymentData } = decodedBody
            const merchantTransactionId = paymentData.merchantTransactionId

            if (code === "PAYMENT_SUCCESS") {
                return {
                    action: "authorized",
                    data: {
                        session_id: merchantTransactionId,
                        amount: paymentData.amount,
                    },
                }
            } else if (code === "PAYMENT_ERROR" || code === "PAYMENT_DECLINED") {
                return {
                    action: "failed",
                    data: {
                        session_id: merchantTransactionId,
                        amount: paymentData.amount || 0,
                    }
                }
            }
        } catch (e) {
            return { action: "not_supported" }
            // Or log error, but validator usually returns result
        }

        return {
            action: "not_supported",
        }
    }
}
