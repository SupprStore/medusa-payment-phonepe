export interface PhonePeOptions {
    // SDK-aligned credentials (preferred)
    clientId?: string
    clientSecret?: string
    clientVersion?: string | number

    // Legacy credentials (deprecated; kept for backward compatibility)
    merchantId?: string
    saltKey?: string
    saltIndex?: string

    redirectUrl: string
    callbackUrl?: string
    mode: "uat" | "prod"

    // Webhook callback auth (SDK validateCallback)
    callbackUsername?: string
    callbackPassword?: string

    // SDK client behavior
    shouldPublishEvents?: boolean

    // Retry behavior for transient SDK failures
    maxRetries?: number
    retryDelayMs?: number

    // Webhook verification behavior
    webhookVerifyWithApi?: boolean
}
