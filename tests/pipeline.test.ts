import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPrisma, disconnectDatabase } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

describe("Buyer → Merchant Data Pipeline", () => {
  beforeAll(() => {
    prisma = getPrisma()!;
    if (!prisma) {
      throw new Error("Database not configured");
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe("1. Google User → Buyer Persistence", () => {
    it("should create user with Google auth", async () => {
      const googleUserId = `google_test_${Date.now()}`;
      const user = await prisma.user.create({
        data: {
          id: googleUserId,
          email: `test_${Date.now()}@google.test`,
          name: "Test User",
          accountType: "CONSUMER",
          emailVerifiedAt: new Date(),
        },
      });

      expect(user.id).toBe(googleUserId);
      expect(user.accountType).toBe("CONSUMER");
      expect(user.emailVerifiedAt).toBeTruthy();
    });

    it("should upsert user on subsequent Google auth", async () => {
      const googleUserId = `google_upsert_${Date.now()}`;
      const email = `test_upsert_${Date.now()}@google.test`;

      // First create
      const user1 = await prisma.user.upsert({
        where: { id: googleUserId },
        create: {
          id: googleUserId,
          email,
          name: "Test User",
          accountType: "CONSUMER",
        },
        update: {
          name: "Updated Name",
        },
      });

      // Second upsert with update
      const user2 = await prisma.user.upsert({
        where: { id: googleUserId },
        create: {
          id: googleUserId,
          email,
          name: "Test User",
          accountType: "CONSUMER",
        },
        update: {
          name: "Updated Name 2",
        },
      });

      expect(user2.id).toBe(user1.id);
      expect(user2.name).toBe("Updated Name 2");
    });
  });

  describe("2. Buyer Profile Persistence", () => {
    let testUserId: string;

    beforeAll(async () => {
      testUserId = `google_profile_${Date.now()}`;
      await prisma.user.create({
        data: {
          id: testUserId,
          email: `profile_${Date.now()}@test.com`,
          name: "Profile Test",
          accountType: "CONSUMER",
        },
      });
    });

    it("should create consumer profile with phone", async () => {
      const profile = await prisma.consumerProfile.create({
        data: {
          userId: testUserId,
          phone: "+919876543210",
          orderContactConsent: true,
        },
      });

      expect(profile.userId).toBe(testUserId);
      expect(profile.phone).toBe("+919876543210");
      expect(profile.orderContactConsent).toBe(true);
    });

    it("should create delivery addresses with contact consent", async () => {
      const profile = await prisma.consumerProfile.findUnique({
        where: { userId: testUserId },
      });

      const address = await prisma.deliveryAddress.create({
        data: {
          profileId: profile!.id,
          name: "Home",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          contactConsent: true,
          isDefault: true,
        },
      });

      expect(address.city).toBe("Mumbai");
      expect(address.contactConsent).toBe(true);
      expect(address.isDefault).toBe(true);
    });

    it("should retrieve consumer profile with addresses", async () => {
      const profile = await prisma.consumerProfile.findUnique({
        where: { userId: testUserId },
        include: { deliveryAddresses: true },
      });

      expect(profile).toBeTruthy();
      expect(profile!.deliveryAddresses.length).toBeGreaterThan(0);
      expect(profile!.deliveryAddresses[0].contactConsent).toBe(true);
    });
  });

  describe("3. Product Interest Persistence", () => {
    let testUserId: string;
    let merchantId: string;
    let productId: string;

    beforeAll(async () => {
      // Create test merchant
      const merchant = await prisma.merchant.create({
        data: {
          name: "Test Merchant",
          email: `merchant_${Date.now()}@test.com`,
        },
      });
      merchantId = merchant.id;

      // Create test product
      const product = await prisma.product.create({
        data: {
          merchantId,
          sku: `SKU_${Date.now()}`,
          name: "Test Product",
          category: "Electronics",
          price: 50000, // ₹500
          cost: 30000, // ₹300
          stock: 100,
        },
      });
      productId = product.id;

      // Create test consumer
      testUserId = `google_interest_${Date.now()}`;
      const profile = await prisma.user.create({
        data: {
          id: testUserId,
          email: `interest_${Date.now()}@test.com`,
          name: "Interest Test",
          accountType: "CONSUMER",
        },
      });

      // Create consumer profile
      await prisma.consumerProfile.create({
        data: {
          userId: profile.id,
          phone: "+919876543210",
          orderContactConsent: true,
        },
      });

      // Create delivery address
      const consumerProfile = await prisma.consumerProfile.findUnique({
        where: { userId: profile.id },
      });
      await prisma.deliveryAddress.create({
        data: {
          profileId: consumerProfile!.id,
          name: "Home",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          contactConsent: true,
        },
      });
    });

    it("should create buyer interest", async () => {
      const interest = await prisma.buyerInterest.create({
        data: {
          userId: testUserId,
          merchantId,
          productId,
          quantity: 2,
          preferredPrice: 45000,
          requirements: { condition: "New", deliveryDays: 7 },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      expect(interest.userId).toBe(testUserId);
      expect(interest.merchantId).toBe(merchantId);
      expect(interest.status).toBe("OPEN");
      expect(interest.quantity).toBe(2);
    });

    it("should retrieve buyer interests for consumer", async () => {
      const interests = await prisma.buyerInterest.findMany({
        where: { userId: testUserId },
        include: { product: true },
      });

      expect(interests.length).toBeGreaterThan(0);
      expect(interests[0].userId).toBe(testUserId);
    });

    it("should pin buyer interest for merchant", async () => {
      const interest = await prisma.buyerInterest.findFirst({
        where: { userId: testUserId, merchantId },
      });

      const pinned = await prisma.buyerInterest.update({
        where: { id: interest!.id },
        data: {
          notificationPinned: true,
          notificationPinnedAt: new Date(),
        },
      });

      expect(pinned.notificationPinned).toBe(true);
      expect(pinned.notificationPinnedAt).toBeTruthy();
    });
  });

  describe("4. Merchant Authorization Isolation", () => {
    let merchant1Id: string;
    let merchant2Id: string;
    let buyerUserId: string;
    let product1Id: string;
    let product2Id: string;

    beforeAll(async () => {
      // Create two merchants
      const m1 = await prisma.merchant.create({
        data: {
          name: "Merchant 1",
          email: `m1_${Date.now()}@test.com`,
        },
      });
      merchant1Id = m1.id;

      const m2 = await prisma.merchant.create({
        data: {
          name: "Merchant 2",
          email: `m2_${Date.now()}@test.com`,
        },
      });
      merchant2Id = m2.id;

      // Create products for each
      const p1 = await prisma.product.create({
        data: {
          merchantId: merchant1Id,
          sku: `SKU_M1_${Date.now()}`,
          name: "M1 Product",
          category: "Electronics",
          price: 50000,
          cost: 30000,
          stock: 100,
        },
      });
      product1Id = p1.id;

      const p2 = await prisma.product.create({
        data: {
          merchantId: merchant2Id,
          sku: `SKU_M2_${Date.now()}`,
          name: "M2 Product",
          category: "Electronics",
          price: 60000,
          cost: 35000,
          stock: 100,
        },
      });
      product2Id = p2.id;

      // Create buyer
      buyerUserId = `google_iso_${Date.now()}`;
      const buyer = await prisma.user.create({
        data: {
          id: buyerUserId,
          email: `iso_${Date.now()}@test.com`,
          name: "Isolation Test",
          accountType: "CONSUMER",
        },
      });

      const profile = await prisma.consumerProfile.create({
        data: {
          userId: buyer.id,
          phone: "+919876543210",
          orderContactConsent: true,
        },
      });

      await prisma.deliveryAddress.create({
        data: {
          profileId: profile.id,
          name: "Home",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          contactConsent: true,
        },
      });
    });

    it("should only return merchant's own buyer interests", async () => {
      // Create interests for both products
      await prisma.buyerInterest.create({
        data: {
          userId: buyerUserId,
          merchantId: merchant1Id,
          productId: product1Id,
          quantity: 1,
        },
      });

      await prisma.buyerInterest.create({
        data: {
          userId: buyerUserId,
          merchantId: merchant2Id,
          productId: product2Id,
          quantity: 1,
        },
      });

      // Merchant 1 should only see their interest
      const m1Interests = await prisma.buyerInterest.findMany({
        where: { merchantId: merchant1Id },
      });

      expect(m1Interests.length).toBeGreaterThan(0);
      m1Interests.forEach((interest) => {
        expect(interest.merchantId).toBe(merchant1Id);
      });

      // Verify no cross-merchant visibility
      m1Interests.forEach((interest) => {
        expect(interest.merchantId).not.toBe(merchant2Id);
      });
    });

    it("should prevent unauthorized merchant access", async () => {
      const interest = await prisma.buyerInterest.findFirst({
        where: { merchantId: merchant1Id },
      });

      // Verify merchant 2 cannot find merchant 1's interests
      const unauthorized = await prisma.buyerInterest.findFirst({
        where: {
          id: interest!.id,
          merchantId: merchant2Id, // Wrong merchant
        },
      });

      expect(unauthorized).toBeNull();
    });
  });

  describe("5. Order Creation from Accepted Interest", () => {
    let merchantId: string;
    let buyerUserId: string;
    let productId: string;
    let interestId: string;

    beforeAll(async () => {
      // Setup
      const merchant = await prisma.merchant.create({
        data: {
          name: "Order Test Merchant",
          email: `order_m_${Date.now()}@test.com`,
        },
      });
      merchantId = merchant.id;

      const product = await prisma.product.create({
        data: {
          merchantId,
          sku: `SKU_ORDER_${Date.now()}`,
          name: "Order Product",
          category: "Electronics",
          price: 50000,
          cost: 30000,
          stock: 100,
        },
      });
      productId = product.id;

      buyerUserId = `google_order_${Date.now()}`;
      const buyer = await prisma.user.create({
        data: {
          id: buyerUserId,
          email: `order_${Date.now()}@test.com`,
          name: "Order Test",
          accountType: "CONSUMER",
        },
      });

      const profile = await prisma.consumerProfile.create({
        data: {
          userId: buyer.id,
          phone: "+919876543210",
          orderContactConsent: true,
        },
      });

      await prisma.deliveryAddress.create({
        data: {
          profileId: profile.id,
          name: "Home",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          contactConsent: true,
        },
      });

      // Create interest
      const interest = await prisma.buyerInterest.create({
        data: {
          userId: buyerUserId,
          merchantId,
          productId,
          quantity: 2,
          status: "OFFER_MADE",
          merchantCounterPrice: 48000,
        },
      });
      interestId = interest.id;
    });

    it("should create order when interest accepted", async () => {
      const addressId = (
        await prisma.consumerProfile.findUnique({
          where: { userId: buyerUserId },
          include: { deliveryAddresses: true },
        })
      )!.deliveryAddresses[0].id;

      const order = await prisma.order.create({
        data: {
          merchantId,
          consumerId: buyerUserId,
          buyerInterestId: interestId,
          amount: 48000 * 2, // 2 units at counter price
          currency: "INR",
          status: "PAYMENT_PENDING",
          source: "BUYER_INTEREST",
          items: {
            create: {
              productId,
              quantity: 2,
              unitPrice: 48000,
              total: 48000 * 2,
            },
          },
        },
      });

      expect(order.buyerInterestId).toBe(interestId);
      expect(order.consumerId).toBe(buyerUserId);
      expect(order.amount).toBe(96000);
      expect(order.status).toBe("PAYMENT_PENDING");
    });

    it("should update buyer interest to ACCEPTED with order link", async () => {
      const order = await prisma.order.findFirst({
        where: { buyerInterestId: interestId },
      });

      const updated = await prisma.buyerInterest.update({
        where: { id: interestId },
        data: {
          status: "ACCEPTED",
          convertedToOrder: true,
          orderId: order!.id,
        },
      });

      expect(updated.status).toBe("ACCEPTED");
      expect(updated.convertedToOrder).toBe(true);
      expect(updated.orderId).toBe(order!.id);
    });
  });

  describe("6. Payment Verification", () => {
    let merchantId: string;
    let buyerUserId: string;
    let orderId: string;

    beforeAll(async () => {
      const merchant = await prisma.merchant.create({
        data: {
          name: "Payment Test Merchant",
          email: `payment_m_${Date.now()}@test.com`,
          razorpayAccountId: "acc_test_123",
        },
      });
      merchantId = merchant.id;

      const product = await prisma.product.create({
        data: {
          merchantId,
          sku: `SKU_PAYMENT_${Date.now()}`,
          name: "Payment Product",
          category: "Electronics",
          price: 50000,
          cost: 30000,
          stock: 100,
        },
      });

      buyerUserId = `google_payment_${Date.now()}`;
      const buyer = await prisma.user.create({
        data: {
          id: buyerUserId,
          email: `payment_${Date.now()}@test.com`,
          name: "Payment Test",
          accountType: "CONSUMER",
        },
      });

      const profile = await prisma.consumerProfile.create({
        data: {
          userId: buyer.id,
          phone: "+919876543210",
          orderContactConsent: true,
        },
      });

      await prisma.deliveryAddress.create({
        data: {
          profileId: profile.id,
          name: "Home",
          phone: "+919876543210",
          addressLine1: "123 Main St",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          contactConsent: true,
        },
      });

      const order = await prisma.order.create({
        data: {
          merchantId,
          consumerId: buyerUserId,
          amount: 50000,
          currency: "INR",
          status: "PENDING",
          source: "BUYER_INTEREST",
          razorpayOrderId: `order_test_${Date.now()}`,
          items: {
            create: {
              productId: product.id,
              quantity: 1,
              unitPrice: 50000,
              total: 50000,
            },
          },
        },
      });
      orderId = order.id;
    });

    it("should create transaction on payment", async () => {
      const transaction = await prisma.transaction.create({
        data: {
          merchantId,
          orderId,
          razorpayPaymentId: `pay_test_${Date.now()}`,
          amount: 50000,
          currency: "INR",
          status: "CAPTURED",
          verified: true,
        },
      });

      expect(transaction.orderId).toBe(orderId);
      expect(transaction.status).toBe("CAPTURED");
      expect(transaction.verified).toBe(true);
    });

    it("should update order status to PAID on payment capture", async () => {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
      });

      expect(updated.status).toBe("PAID");
    });

    it("should decrement product stock on order confirmation", async () => {
      const product = await prisma.product.findFirst({
        where: { merchantId },
      });
      const initialStock = product!.stock;

      await prisma.product.update({
        where: { id: product!.id },
        data: { stock: { decrement: 1 } },
      });

      const updated = await prisma.product.findUnique({
        where: { id: product!.id },
      });

      expect(updated!.stock).toBe(initialStock - 1);
    });
  });

  describe("7. Audit Logging", () => {
    let merchantId: string;

    beforeAll(async () => {
      const merchant = await prisma.merchant.create({
        data: {
          name: "Audit Test Merchant",
          email: `audit_${Date.now()}@test.com`,
        },
      });
      merchantId = merchant.id;
    });

    it("should log buyer interest creation", async () => {
      const log = await prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "USER",
          actorId: "test_user_123",
          action: "BUYER_INTEREST_CREATED",
          resourceType: "BuyerInterest",
          resourceId: "test_interest_123",
          input: { productId: "test_product", quantity: 2 },
        },
      });

      expect(log.action).toBe("BUYER_INTEREST_CREATED");
      expect(log.resourceType).toBe("BuyerInterest");
      expect(log.merchantId).toBe(merchantId);
    });

    it("should log merchant offer", async () => {
      const log = await prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "USER",
          actorId: "merchant_user_123",
          action: "MERCHANT_OFFER_MADE",
          resourceType: "BuyerInterest",
          resourceId: "test_interest_123",
          input: {
            merchantCounterPrice: 48000,
            merchantResponse: "Can offer at ₹480",
          },
        },
      });

      expect(log.action).toBe("MERCHANT_OFFER_MADE");
    });

    it("should log order creation", async () => {
      const log = await prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "USER",
          actorId: "buyer_user_123",
          action: "BUYER_ACCEPTED_OFFER",
          resourceType: "Order",
          resourceId: "test_order_123",
          input: {
            buyerInterestId: "test_interest_123",
            acceptedPrice: 48000,
          },
        },
      });

      expect(log.action).toBe("BUYER_ACCEPTED_OFFER");
    });

    it("should log payment events", async () => {
      const log = await prisma.auditLog.create({
        data: {
          merchantId,
          actorType: "RAZORPAY",
          action: "PAYMENT_CAPTURED",
          resourceType: "Order",
          resourceId: "test_order_123",
          input: { paymentId: "pay_test_123", amount: 50000 },
        },
      });

      expect(log.actorType).toBe("RAZORPAY");
      expect(log.action).toBe("PAYMENT_CAPTURED");
    });

    it("should retrieve audit logs for merchant", async () => {
      const logs = await prisma.auditLog.findMany({
        where: { merchantId },
        orderBy: { createdAt: "desc" },
      });

      expect(logs.length).toBeGreaterThan(0);
      logs.forEach((log) => {
        expect(log.merchantId).toBe(merchantId);
      });
    });
  });
});
