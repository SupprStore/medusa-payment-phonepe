export interface PhonePeOptions {
    clientId: string
    clientSecret: string
    clientVersion: number
    redirectUrl: string
    callbackUrl?: string
    callbackUsername: string
    callbackPassword: string
    mode: "uat" | "prod"
}
