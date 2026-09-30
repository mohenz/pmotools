import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import fs from "fs";
import path from "path";

describe("Security Hardening & Defect Remediation", () => {
  it("verifies next.config.ts has poweredByHeader disabled", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("verifies next.config.ts enforces critical security headers", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const headerRules = await nextConfig.headers!();
    expect(headerRules.length).toBeGreaterThan(0);

    const globalRule = headerRules.find((rule) => rule.source === "/:path*");
    expect(globalRule).toBeDefined();

    const headerMap = new Map(globalRule!.headers.map((h) => [h.key, h.value]));

    // Anti-Clickjacking
    expect(headerMap.get("X-Frame-Options")).toBe("SAMEORIGIN");

    // MIME sniffing protection
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");

    // Strict Transport Security (HSTS)
    expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=");

    // Referrer Policy
    expect(headerMap.get("Referrer-Policy")).toBe("origin-when-cross-origin");

    // Permissions Policy
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
  });

  it("verifies db-export route uses timing-safe token verification and environment variable", () => {
    const routeSource = fs.readFileSync(
      path.resolve(__dirname, "../../app/api/admin/db-export/route.ts"),
      "utf8"
    );

    // Hardcoded raw string comparison is eliminated
    expect(routeSource).not.toMatch(/token\s*===\s*["']pmo-internal-sync-2026["']/);

    // crypto.timingSafeEqual is used to prevent timing side-channel attacks
    expect(routeSource).toContain("crypto.timingSafeEqual");

    // process.env is referenced for secret configuration
    expect(routeSource).toContain("process.env.INTERNAL_SYNC_SECRET");

    // Cache-Control: no-store is enforced
    expect(routeSource).toContain("no-store");
  });
});
