import { PaymentSessionStatus } from "@medusajs/framework/utils"
import { CreateSdkOrderRequest, MetaInfo, StandardCheckoutPayRequest } from "pg-sdk-node"

export const PhonePeMapper = {
    buildStandardCheckoutPayRequest: (params: {
        merchantOrderId: string
        amount: number
        redirectUrl: string
        message: string
        metaInfo?: MetaInfo
    }) => {
        const builder = StandardCheckoutPayRequest.builder()
            .merchantOrderId(params.merchantOrderId)
            .amount(params.amount)
            .redirectUrl(params.redirectUrl)
            .message(params.message)

        if (params.metaInfo) {
            builder.metaInfo(params.metaInfo)
        }

        return builder.build()
    },

    buildCreateSdkOrderRequest: (params: {
        merchantOrderId: string
        amount: number
        redirectUrl: string
        message: string
        metaInfo?: MetaInfo
    }) => {
        const builder = CreateSdkOrderRequest.StandardCheckoutBuilder()
            .merchantOrderId(params.merchantOrderId)
            .amount(params.amount)
            .redirectUrl(params.redirectUrl)
            .message(params.message)

        if (params.metaInfo) {
            builder.metaInfo(params.metaInfo)
        }

        return builder.build()
    },

    mapOrderStatus: (state?: string) => {
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
            default:
                return PaymentSessionStatus.ERROR
        }
    }
}
