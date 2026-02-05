import { BigNumberInput } from "@medusajs/types"
import { PaymentProviderContext } from "@medusajs/types"

export type PhonePePaymentData = {
    merchantOrderId?: string
    merchantTransactionId?: string
    merchantRefundId?: string
    id?: string
    session_id?: string
    cart_id?: string
    currency_code?: string
    mobile_number?: string
    device_id?: string
    device_os?: string
    app_version?: string
}

export type PhonePeContext = PaymentProviderContext & {
    payment_session_data?: { merchantTransactionId?: string }
}

export type PhonePeOperationInput = {
    amount?: BigNumberInput
    currency_code?: string
    data?: PhonePePaymentData
    context?: PhonePeContext
}
