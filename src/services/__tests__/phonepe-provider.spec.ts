import { PhonePeProvider } from "../phonepe-provider"
import { StandardCheckoutClient, StandardCheckoutPayRequest, RefundRequest } from "pg-sdk-node"

jest.mock("pg-sdk-node")

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

    const mockClient = {
        pay: jest.fn(),
        refund: jest.fn(),
        getOrderStatus: jest.fn(),
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (StandardCheckoutClient.getInstance as jest.Mock).mockReturnValue(mockClient);

        // Mock StandardCheckoutPayRequest
        (StandardCheckoutPayRequest.builder as jest.Mock).mockReturnValue({
            merchantOrderId: jest.fn().mockReturnThis(),
            amount: jest.fn().mockReturnThis(),
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

        provider = new PhonePeProvider(container, options)
    })

    describe("initiatePayment", () => {
        it("should initiate payment successfully", async () => {
            const input = {
                amount: 1000,
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
                redirectUrl: "https://phonepe.com/pay",
                merchantTransactionId: "MT123"
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

            const result = await provider.authorizePayment({ merchantTransactionId: "MT123" })

            expect(result.status).toBe("authorized")
            expect(result.data.paymentId).toBe("PG123")
        })

        it("should return pending status when payment is pending", async () => {
            mockClient.getOrderStatus.mockResolvedValue({
                state: "PENDING"
            })

            const result = await provider.authorizePayment({ merchantTransactionId: "MT123" })

            expect(result.status).toBe("pending")
        })
    })

    describe("refundPayment", () => {
        it("should process refund successfully", async () => {
            const input = {
                amount: 500,
                data: { merchantTransactionId: "MT123" }
            }

            mockClient.refund.mockResolvedValue({
                state: "COMPLETED",
                refundId: "REF123",
                amount: 500
            })

            const result = await provider.refundPayment(input)

            expect(mockClient.refund).toHaveBeenCalled()
            expect(result.refundParams.state).toBe("COMPLETED")
        })
    })
})
