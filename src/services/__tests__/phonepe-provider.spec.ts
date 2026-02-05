import { PhonePeProvider } from "../phonepe-provider"
import { CreateSdkOrderRequest, MetaInfo, StandardCheckoutClient, StandardCheckoutPayRequest, RefundRequest } from "pg-sdk-node"
import * as crypto from "crypto"

jest.mock("pg-sdk-node")

describe("PhonePeProvider", () => {
    let provider: PhonePeProvider
    const options = {
        clientId: "TESTCLIENT",
        clientSecret: "test-client-secret",
        clientVersion: "1",
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

    const mockClient = {
        pay: jest.fn(),
        refund: jest.fn(),
        getOrderStatus: jest.fn(),
        validateCallback: jest.fn(),
        createSdkOrder: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (StandardCheckoutClient.getInstance as jest.Mock).mockReturnValue(mockClient);

        // Mock StandardCheckoutPayRequest
        (StandardCheckoutPayRequest.builder as jest.Mock).mockReturnValue({
            merchantOrderId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            metaInfo: jest.fn().mockReturnThis(),
            redirectUrl: jest.fn().mockReturnThis(),
            message: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        });

        // Mock RefundRequest
        (RefundRequest.builder as jest.Mock).mockReturnValue({
            merchantRefundId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            originalMerchantOrderId: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        });

        // Mock MetaInfo
        ;(MetaInfo as any).builder = jest.fn().mockReturnValue({
            udf1: jest.fn().mockReturnThis(),
            udf2: jest.fn().mockReturnThis(),
            udf3: jest.fn().mockReturnThis(),
            udf4: jest.fn().mockReturnThis(),
            udf5: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        })

        // Mock CreateSdkOrderRequest
        ;(CreateSdkOrderRequest as any).StandardCheckoutBuilder = jest.fn().mockReturnValue({
            merchantOrderId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            metaInfo: jest.fn().mockReturnThis(),
            redirectUrl: jest.fn().mockReturnThis(),
            message: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        })

        provider = new PhonePeProvider(container, options)
    })

    describe("initiatePayment", () => {
        it("should initiate payment successfully", async () => {
            const input = {
                amount: 1000,
                currency_code: "INR",
                context: {
                    payment_session_data: { merchantTransactionId: "MT123" },
                    customer: { id: "cust_123" }
                }
            }

            mockClient.pay.mockResolvedValue({
                redirectUrl: "https://phonepe.com/pay"
            })

            const result = await provider.initiatePayment(input)

            expect(StandardCheckoutClient.getInstance).toHaveBeenCalled()
            expect(StandardCheckoutPayRequest.builder).toHaveBeenCalled()
            expect(mockClient.pay).toHaveBeenCalled()
            expect(result).toEqual({
                id: "MT123",
                data: {
                    merchantOrderId: "MT123",
                    redirectUrl: "https://phonepe.com/pay"
                }
            })
        })
    })

    describe("authorizePayment", () => {
        it("should return authorized status when payment is successful", async () => {
            mockClient.getOrderStatus.mockResolvedValue({
                state: "COMPLETED",
                orderId: "PG123",
                amount: 1000
            })

            const result = await provider.authorizePayment({ data: { merchantOrderId: "MT123" } })

            expect(result.status).toBe("authorized")
            expect(result.data.paymentId).toBe("PG123")
        })

        it("should return pending status when payment is pending", async () => {
            mockClient.getOrderStatus.mockResolvedValue({
                state: "PENDING"
            })

            const result = await provider.authorizePayment({ data: { merchantOrderId: "MT123" } })

            expect(result.status).toBe("pending")
        })
    })

    describe("refundPayment", () => {
        it("should process refund successfully", async () => {
            const input = {
                amount: 500,
                data: { merchantOrderId: "MT123" },
                currency_code: "INR"
            }

            mockClient.refund.mockResolvedValue({
                state: "COMPLETED",
                refundId: "REF123",
                amount: 500
            })

            const result = await provider.refundPayment(input)

            expect(mockClient.refund).toHaveBeenCalled()
            expect(result.data.refundResponse.state).toBe("COMPLETED")
        })
    })

    describe("createSdkOrder", () => {
        it("should create sdk order successfully", async () => {
            const input = {
                amount: 1000,
                currency_code: "INR",
                context: {
                    payment_session_data: { merchantTransactionId: "MT123" },
                    customer: { id: "cust_123" }
                }
            }

            mockClient.createSdkOrder.mockResolvedValue({
                token: "sdk-token"
            })

            const result = await provider.createSdkOrder(input)

            expect((CreateSdkOrderRequest as any).StandardCheckoutBuilder).toHaveBeenCalled()
            expect(mockClient.createSdkOrder).toHaveBeenCalled()
            expect(result.data.sdkOrder.token).toBe("sdk-token")
        })
    })

    describe("getWebhookActionAndData", () => {
        const validBody = {
            code: "PAYMENT_SUCCESS",
            data: {
                merchantTransactionId: "MT123",
                amount: 1000
            }
        }
        const encodedBody = Buffer.from(JSON.stringify(validBody)).toString("base64")
        const saltKey = "test-salt-key"
        const saltIndex = "1"
        const validSignature = crypto.createHash("sha256").update(encodedBody + saltKey).digest("hex") + "###" + saltIndex

        it("should return authorized action for successful payment with valid signature", async () => {
            const payload = {
                data: { response: encodedBody },
                headers: { "x-verify": validSignature }
            }

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({
                action: "authorized",
                data: {
                    session_id: "MT123",
                    amount: 1000
                }
            })
        })

        it("should validate callbacks using SDK when authorization is present", async () => {
            const payload = {
                data: { any: "payload" },
                rawData: JSON.stringify({}),
                headers: { authorization: "Basic abc123" }
            }

            mockClient.validateCallback.mockReturnValue({
                payload: { state: "COMPLETED", merchantOrderId: "MT456", amount: 2000 }
            })

            const providerWithCallback = new PhonePeProvider(container, {
                ...options,
                callbackUsername: "cb-user",
                callbackPassword: "cb-pass",
            })

            const result = await providerWithCallback.getWebhookActionAndData(payload as any)

            expect(result).toEqual({
                action: "authorized",
                data: { session_id: "MT456", amount: 2000 }
            })
        })

        it("should return not_supported if signature is missing", async () => {
            const payload = {
                data: { response: encodedBody },
                headers: {}
            }

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({ action: "not_supported" })
        })

        it("should return failed action for invalid signature", async () => {
            const payload = {
                data: { response: encodedBody },
                headers: { "x-verify": "invalid-signature" }
            }

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({ action: "failed" })
            expect(container.logger.error).toHaveBeenCalledWith("PhonePe Webhook: Verification Failed or Payment Failed")
        })

        it("should return failed action for payment error code", async () => {
            const errorBody = {
                code: "PAYMENT_ERROR",
                data: { merchantTransactionId: "MT123" }
            }
            const encodedError = Buffer.from(JSON.stringify(errorBody)).toString("base64")
            const signature = crypto.createHash("sha256").update(encodedError + saltKey).digest("hex") + "###" + saltIndex

            const payload = {
                data: { response: encodedError },
                headers: { "x-verify": signature }
            }

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({
                action: "failed",
                data: { session_id: "MT123", amount: 0 }
            })
        })
    })
})
