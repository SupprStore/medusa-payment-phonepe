export interface PhonePeOptions {
    merchantId: string
    saltKey: string
    saltIndex: string
    redirectUrl: string
    callbackUrl?: string
    redirectMode?: "POST" | "GET"
    mode: "uat" | "prod"
}
