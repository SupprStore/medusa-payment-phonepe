export interface PhonePeOptions {
    merchantId: string
    saltKey: string
    saltIndex: string
    redirectUrl: string
    callbackUrl?: string
    redirectMode?: "POST" | "GET"
    mode: "uat" | "prod"
}

export interface PhonePePaymentInstrument {
    type: string
    [key: string]: any
}

export interface PhonePeInitiateRequest {
    merchantId: string
    merchantTransactionId: string
    merchantUserId: string
    amount: number
    redirectUrl: string
    redirectMode: string
    callbackUrl?: string
    mobileNumber?: string
    paymentInstrument?: PhonePePaymentInstrument
}

export interface PhonePeResponse<T = any> {
    success: boolean
    code: string
    message: string
    data: T
}

export interface PhonePeStatusData {
    merchantId: string
    merchantTransactionId: string
    transactionId: string
    amount: number
    state: string
    responseCode: string
    paymentInstrument: any
}

export interface PhonePeRefundRequest {
    merchantId: string
    merchantUserId: string
    originalTransactionId: string
    merchantTransactionId: string
    amount: number
    callbackUrl?: string
}
