import { BigNumber, defaultCurrencies } from "@medusajs/framework/utils"

const PHONEPE_CURRENCY = "INR"

function getDecimalDigits(): number {
    return defaultCurrencies[PHONEPE_CURRENCY]?.decimal_digits ?? 2
}

export function assertPhonePeCurrency(currencyCode: string): void {
    if (currencyCode?.toUpperCase() !== PHONEPE_CURRENCY) {
        throw new Error(
            `PhonePe only supports ${PHONEPE_CURRENCY} payments, received currency code "${currencyCode}"`
        )
    }
}

// Medusa amounts are major-unit decimals (e.g. 500 for INR 500.00); PhonePe requires an integer paisa amount.
export function toPhonePeAmount(amount: unknown): number {
    const numeric = new BigNumber(amount as any).numeric
    return Math.round(numeric * 10 ** getDecimalDigits())
}

// Inverse of toPhonePeAmount, for mapping PhonePe callback amounts back to Medusa's major-unit decimals.
export function fromPhonePeAmount(paisaAmount: number): number {
    return paisaAmount / 10 ** getDecimalDigits()
}
