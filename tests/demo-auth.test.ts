import { afterEach, describe, expect, it, vi } from "vitest";
import { demoLoginEnabled, getDemoAccount, isDemoAccount, listDemoAccounts, verifyDemoPin } from "../lib/demo-auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("built-in demo login", () => {
  it("ships a merchant and a buyer account outside production", () => {
    expect(demoLoginEnabled()).toBe(true);
    const accounts = listDemoAccounts();
    expect(accounts.map((a) => a.accountType)).toEqual(["MERCHANT", "CONSUMER"]);
    expect(accounts.map((a) => a.email)).toEqual(["demo@akuma.app", "buyer@akuma.app"]);
    expect(accounts.map((a) => a.pin)).toEqual(["123456", "654321"]);
  });

  it("accepts the built-in PIN and rejects a wrong one", () => {
    expect(verifyDemoPin("demo@akuma.app", "123456")).toBe(true);
    expect(verifyDemoPin("buyer@akuma.app", "654321")).toBe(true);
    expect(verifyDemoPin("demo@akuma.app", "654321")).toBe(false);
    expect(verifyDemoPin("demo@akuma.app", "12345")).toBe(false);
    expect(verifyDemoPin("demo@akuma.app", "")).toBe(false);
  });

  it("matches emails regardless of case and surrounding whitespace", () => {
    expect(isDemoAccount("  DEMO@Akuma.App ")).toBe(true);
    expect(getDemoAccount("DEMO@AKUMA.APP")?.accountType).toBe("MERCHANT");
    expect(verifyDemoPin(" demo@AKUMA.app ", " 123456 ")).toBe(true);
  });

  it("leaves real accounts alone", () => {
    expect(getDemoAccount("someone@example.com")).toBeNull();
    expect(isDemoAccount(undefined)).toBe(false);
    // A non-demo email can never pass the PIN gate, whatever the code.
    expect(verifyDemoPin("someone@example.com", "123456")).toBe(false);
  });

  it("is off in production unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(demoLoginEnabled()).toBe(false);
    expect(listDemoAccounts()).toEqual([]);
    expect(verifyDemoPin("demo@akuma.app", "123456")).toBe(false);

    vi.stubEnv("DEMO_LOGIN_ENABLED", "true");
    expect(demoLoginEnabled()).toBe(true);
    expect(verifyDemoPin("demo@akuma.app", "123456")).toBe(true);
  });

  it("honours env overrides for the email and PIN", () => {
    vi.stubEnv("DEMO_MERCHANT_EMAIL", "Owner@Shop.test");
    vi.stubEnv("DEMO_MERCHANT_PIN", "999111");
    expect(getDemoAccount("owner@shop.test")?.pin).toBe("999111");
    expect(verifyDemoPin("owner@shop.test", "999111")).toBe(true);
    expect(isDemoAccount("demo@akuma.app")).toBe(false);
  });
});
