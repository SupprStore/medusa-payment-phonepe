import { PhonePeClientWrapper } from "../phonepe-client-wrapper"
import { PhonePeMapper } from "../mappers/phonepe-mapper"

export class ReconciliationOperations {
    constructor(private clientWrapper: PhonePeClientWrapper) { }

    async reconcilePayments(merchantOrderIds: string[]) {
        const results = await Promise.all(
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

        return results
    }

    async reconcileRefunds(refundIds: string[]) {
        const results = await Promise.all(
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

        return results
    }
}
