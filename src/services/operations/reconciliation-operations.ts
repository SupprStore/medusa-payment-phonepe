import { PhonePeClientWrapper } from "../phonepe-client-wrapper"
import { PhonePeMapper } from "../mappers/phonepe-mapper"

export class ReconciliationOperations {
    constructor(private clientWrapper: PhonePeClientWrapper) { }

    async reconcilePayments(merchantOrderIds: string[]) {
        const results = await Promise.allSettled(
            merchantOrderIds.map(async (merchantOrderId) => {
                const status = await this.clientWrapper.getOrderStatus(merchantOrderId)
                return {
                    merchantOrderId,
                    status: PhonePeMapper.mapOrderStatus(status.state),
                    state: status.state,
                    amount: status.amount,
                    orderId: status.orderId
                }
            })
        )

        return results.map((result, index) => {
            if (result.status === "fulfilled") {
                return result.value
            }

            return {
                merchantOrderId: merchantOrderIds[index],
                error: result.reason?.message || "reconciliation_failed"
            }
        })
    }

    async reconcileRefunds(refundIds: string[]) {
        const results = await Promise.allSettled(
            refundIds.map(async (refundId) => {
                const status = await this.clientWrapper.getRefundStatus(refundId)
                return {
                    refundId,
                    state: status.state,
                    amount: status.amount,
                    merchantRefundId: status.merchantRefundId,
                    originalMerchantOrderId: status.originalMerchantOrderId
                }
            })
        )

        return results.map((result, index) => {
            if (result.status === "fulfilled") {
                return result.value
            }

            return {
                refundId: refundIds[index],
                error: result.reason?.message || "reconciliation_failed"
            }
        })
    }
}
