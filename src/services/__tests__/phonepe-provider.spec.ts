
import { PhonePeProvider } from "../phonepe-provider"
import crypto from "crypto"

describe("PhonePeProvider", () => {
    let provider: PhonePeProvider
    const options = {
        merchantId: "TESTMERCHANT",
        saltKey: "test-salt-key",
        saltIndex: "1",
        redirectUrl: "https://example.com/redirect",
        callbackUrl: "https://example.com/callback",
        mode: "uat" as const,
    }

    const container = {
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        } as any,
    }

    beforeEach(() => {
        provider = new PhonePeProvider(container, options)
    })

    describe("generateChecksum", () => {
        it("should generate correct checksum", () => {
            // Access protected method for testing
            const generateChecksum = (provider as any).generateChecksum.bind(provider)

            const payload = "test-base64-payload"
            const apiPath = "/pg/v1/pay"

            const expectedString = payload + apiPath + options.saltKey
            const expectedHash = crypto.createHash("sha256").update(expectedString).digest("hex")
            const expectedChecksum = `${expectedHash}###${options.saltIndex}`

            expect(generateChecksum(payload, apiPath)).toBe(expectedChecksum)
        })
    })
})
