import { ProviderWebhookPayload, WebhookActionResult } from "@medusajs/types"
import { CallbackType, PhonePeException } from "pg-sdk-node"
import { PhonePeOptions } from "../../types"
import { PhonePeClientWrapper } from "../phonepe-client-wrapper"
import { fromPhonePeAmount } from "../utils/currency"

const COMPLETED_TYPES = new Set([CallbackType.PG_ORDER_COMPLETED, CallbackType.CHECKOUT_ORDER_COMPLETED])
const FAILED_TYPES = new Set([
    CallbackType.PG_ORDER_FAILED,
    CallbackType.CHECKOUT_ORDER_FAILED,
    CallbackType.PG_TRANSACTION_ATTEMPT_FAILED,
    CallbackType.CHECKOUT_TRANSACTION_ATTEMPT_FAILED,
])

export class WebhookValidator {
    constructor(
        private clientWrapper: PhonePeClientWrapper,
        private options: PhonePeOptions
    ) { }

    async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
        const { rawData, headers } = payload
        const authorization = (headers["authorization"] ?? headers["Authorization"]) as string | undefined

        if (!authorization) {
            return { action: "not_supported" }
        }

        const rawBody = typeof rawData === "string" ? rawData : rawData.toString("utf-8")

        let callbackResponse
        try {
            callbackResponse = this.clientWrapper.validateCallback(
                this.options.callbackUsername,
                this.options.callbackPassword,
                authorization,
                rawBody
            )
        } catch (e) {
            if (e instanceof PhonePeException) {
                return { action: "failed" }
            }
            throw e
        }

        const { type, payload: data } = callbackResponse
        const sessionId = data.merchantOrderId

        if (!sessionId) {
            return { action: "not_supported" }
        }

        if (COMPLETED_TYPES.has(type)) {
            return {
                action: "authorized",
                data: {
                    session_id: sessionId,
                    amount: fromPhonePeAmount(data.amount),
                },
            }
        }

        if (FAILED_TYPES.has(type)) {
            return {
                action: "failed",
                data: {
                    session_id: sessionId,
                    amount: fromPhonePeAmount(data.amount ?? 0),
                },
            }
        }

        return { action: "not_supported" }
    }
}
