import { PhonePeProvider } from "../phonepe-provider"
import {
    StandardCheckoutClient,
    StandardCheckoutPayRequest,
    RefundRequest,
    CreateSdkOrderRequest,
    CallbackType,
    PhonePeException,
    ServerError,
    BadRequest,
} from "pg-sdk-node"

// Only mock the network-calling classes; keep the real exception hierarchy (PhonePeException /
// ServerError / BadRequest / TooManyRequests) and CallbackType so `instanceof` checks in the
// retry/webhook logic behave the same as they would against the real SDK.
jest.mock("pg-sdk-node", () => {
    const actual = jest.requireActual("pg-sdk-node")
    return {
        ...actual,
        StandardCheckoutClient: { getInstance: jest.fn() },
        StandardCheckoutPayRequest: { builder: jest.fn() },
        RefundRequest: { builder: jest.fn() },
        CreateSdkOrderRequest: { StandardCheckoutBuilder: jest.fn(), CustomCheckoutBuilder: jest.fn() },
    }
})

describe("PhonePeProvider", () => {
    let provider: PhonePeProvider
    const options = {
        clientId: "TEST_CLIENT_ID",
        clientSecret: "test-client-secret",
        clientVersion: 1,
        redirectUrl: "https://example.com/redirect",
        callbackUrl: "https://example.com/callback",
        callbackUsername: "webhook-user",
        callbackPassword: "webhook-pass",
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
        getRefundStatus: jest.fn(),
        createSdkOrder: jest.fn(),
        validateCallback: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (StandardCheckoutClient.getInstance as jest.Mock).mockReturnValue(mockClient);

        (StandardCheckoutPayRequest.builder as jest.Mock).mockReturnValue({
            merchantOrderId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            redirectUrl: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        });

        (RefundRequest.builder as jest.Mock).mockReturnValue({
            merchantRefundId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            originalMerchantOrderId: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        });

        (CreateSdkOrderRequest.StandardCheckoutBuilder as jest.Mock).mockReturnValue({
            merchantOrderId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
            redirectUrl: jest.fn().mockReturnThis(),
            build: jest.fn().mockReturnValue({}),
        });

        provider = new PhonePeProvider(container, options)
    })

    describe("initiatePayment", () => {
        const baseInput = {
            amount: 500,
            currency_code: "inr",
            data: { session_id: "payses_123" },
            context: {},
        }

        it("converts the major-unit Medusa amount to integer paisa", async () => {
            mockClient.pay.mockResolvedValue({ redirectUrl: "https://phonepe.com/pay" })

            await provider.initiatePayment(baseInput)

            const builder = (StandardCheckoutPayRequest.builder as jest.Mock).mock.results[0].value
            expect(builder.amount).toHaveBeenCalledWith(50000)
            expect(builder.merchantOrderId).toHaveBeenCalledWith("payses_123")
        })

        it("wraps the redirect URL and session id inside `data` so Medusa persists them", async () => {
            mockClient.pay.mockResolvedValue({ redirectUrl: "https://phonepe.com/pay" })

            const result = await provider.initiatePayment(baseInput)

            expect(result).toEqual({
                id: "payses_123",
                data: {
                    session_id: "payses_123",
                    redirectUrl: "https://phonepe.com/pay",
                },
            })
        })

        it("throws when the Medusa payment session id is missing", async () => {
            await expect(
                provider.initiatePayment({ ...baseInput, data: {} })
            ).rejects.toThrow(/session id/i)
        })

        it("throws for non-INR currencies", async () => {
            await expect(
                provider.initiatePayment({ ...baseInput, currency_code: "usd" })
            ).rejects.toThrow(/INR/i)
        })
    })

    describe("authorizePayment", () => {
        const input = { data: { session_id: "payses_123" }, context: {} }

        it("returns authorized status when payment is successful", async () => {
            mockClient.getOrderStatus.mockResolvedValue({
                state: "COMPLETED",
                orderId: "PG123",
            })

            const result = await provider.authorizePayment(input)

            expect(mockClient.getOrderStatus).toHaveBeenCalledWith("payses_123")
            expect(result.status).toBe("authorized")
            expect(result.data.paymentId).toBe("PG123")
            expect(result.data.session_id).toBe("payses_123")
        })

        it("returns pending status when payment is pending", async () => {
            mockClient.getOrderStatus.mockResolvedValue({ state: "PENDING" })

            const result = await provider.authorizePayment(input)

            expect(result.status).toBe("pending")
        })
    })

    describe("refundPayment", () => {
        it("converts the refund amount to paisa and keys the refund off the session id", async () => {
            const input = {
                amount: 250,
                data: { session_id: "payses_123" },
                context: {},
            }

            mockClient.refund.mockResolvedValue({ state: "PENDING", refundId: "REF123" })

            const result = await provider.refundPayment(input)

            const builder = (RefundRequest.builder as jest.Mock).mock.results[0].value
            expect(builder.amount).toHaveBeenCalledWith(25000)
            expect(builder.originalMerchantOrderId).toHaveBeenCalledWith("payses_123")
            expect(result.data.refundId).toBe("REF123")
        })

        it("throws when PhonePe reports the refund as failed", async () => {
            mockClient.refund.mockResolvedValue({ state: "FAILED" })

            await expect(
                provider.refundPayment({ amount: 100, data: { session_id: "payses_123" }, context: {} })
            ).rejects.toThrow(/Refund state/)
        })
    })

    describe("updatePayment", () => {
        it("reuses the same merchantOrderId as the original initiatePayment call", async () => {
            mockClient.pay.mockResolvedValue({ redirectUrl: "https://phonepe.com/pay" })

            const input = {
                amount: 500,
                currency_code: "inr",
                data: { session_id: "payses_123" },
                context: {},
            }

            await provider.initiatePayment(input)
            await provider.updatePayment(input)

            const builders = (StandardCheckoutPayRequest.builder as jest.Mock).mock.results
            expect(builders[0].value.merchantOrderId).toHaveBeenCalledWith("payses_123")
            expect(builders[1].value.merchantOrderId).toHaveBeenCalledWith("payses_123")
        })
    })

    describe("createSdkOrder", () => {
        it("converts the amount to paisa and returns the mobile SDK token", async () => {
            mockClient.createSdkOrder.mockResolvedValue({ token: "sdk-token", orderId: "OMO123" })

            const result = await provider.createSdkOrder({
                amount: 500,
                currency_code: "inr",
                data: { session_id: "payses_123" },
                context: {},
            })

            const builder = (CreateSdkOrderRequest.StandardCheckoutBuilder as jest.Mock).mock.results[0].value
            expect(builder.merchantOrderId).toHaveBeenCalledWith("payses_123")
            expect(builder.amount).toHaveBeenCalledWith(50000)
            expect(result).toEqual({ token: "sdk-token", orderId: "OMO123" })
        })
    })

    describe("retry behavior", () => {
        it("retries a transient ServerError and succeeds", async () => {
            mockClient.getOrderStatus
                .mockRejectedValueOnce(new ServerError("temporary outage", 500))
                .mockResolvedValueOnce({ state: "COMPLETED", orderId: "PG123" })

            const result = await provider.authorizePayment({ data: { session_id: "payses_123" }, context: {} })

            expect(mockClient.getOrderStatus).toHaveBeenCalledTimes(2)
            expect(result.status).toBe("authorized")
        })

        it("does not retry a deterministic BadRequest", async () => {
            mockClient.getOrderStatus.mockRejectedValue(new BadRequest("invalid merchantOrderId", 400))

            await provider.getPaymentStatus({ data: { session_id: "payses_123" }, context: {} })

            expect(mockClient.getOrderStatus).toHaveBeenCalledTimes(1)
        })
    })

    describe("getWebhookActionAndData", () => {
        const rawBody = JSON.stringify({ type: "PG_ORDER_COMPLETED", payload: {} })
        const payload = {
            data: {},
            rawData: rawBody,
            headers: { authorization: "sha256-hash" },
        }

        it("returns authorized action for a completed order callback", async () => {
            mockClient.validateCallback.mockReturnValue({
                type: CallbackType.PG_ORDER_COMPLETED,
                payload: { merchantOrderId: "payses_123", amount: 50000, state: "COMPLETED" },
            })

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(mockClient.validateCallback).toHaveBeenCalledWith(
                "webhook-user",
                "webhook-pass",
                "sha256-hash",
                rawBody
            )
            expect(result).toEqual({
                action: "authorized",
                data: { session_id: "payses_123", amount: 500 },
            })
        })

        it("returns failed action for a failed order callback", async () => {
            mockClient.validateCallback.mockReturnValue({
                type: CallbackType.PG_ORDER_FAILED,
                payload: { merchantOrderId: "payses_123", amount: 50000, state: "FAILED" },
            })

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({
                action: "failed",
                data: { session_id: "payses_123", amount: 500 },
            })
        })

        it("returns failed action when signature validation throws", async () => {
            mockClient.validateCallback.mockImplementation(() => {
                throw new PhonePeException("Invalid signature")
            })

            const result = await provider.getWebhookActionAndData(payload as any)

            expect(result).toEqual({ action: "failed" })
        })

        it("returns not_supported when the authorization header is missing", async () => {
            const result = await provider.getWebhookActionAndData({
                ...payload,
                headers: {},
            } as any)

            expect(result).toEqual({ action: "not_supported" })
            expect(mockClient.validateCallback).not.toHaveBeenCalled()
        })
    })
})
