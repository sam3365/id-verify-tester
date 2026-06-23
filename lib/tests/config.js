import { stripe, isTestMode, createLogger } from "../stripe-client.js";

/**
 * Test Suite: Stripe Identity – Configuration & API Health
 *
 * Verifies that credentials are valid and that the Stripe Identity feature
 * is enabled on the account.
 *
 * Docs: https://docs.stripe.com/identity
 */
export async function run(emit = null) {
  const log = createLogger(emit);
  log.info("Starting Configuration & API Health tests…");

  // ── 1. Verify secret key works by calling Account retrieve ──────────────────
  try {
    log.info("Verifying API key via Account retrieve…");
    const account = await stripe.accounts.retrieve();
    log.ok("API key valid — account retrieved", {
      id:          account.id,
      type:        account.type,
      country:     account.country,
      mode:        isTestMode ? "test" : "live",
      charges_enabled:  account.charges_enabled,
      details_submitted: account.details_submitted,
    });
  } catch (err) {
    log.error("API key validation failed", {
      message: err.message,
      code:    err.code,
      type:    err.type,
    });
    return; // no point running remaining tests without a valid key
  }

  // ── 2. Check Identity is enabled by creating a minimal session ───────────────
  try {
    log.info("Probing Stripe Identity availability (create + immediate cancel)…");
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { source: "stripe-identity-tester", purpose: "config-check" },
      return_url: `${(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/verify/complete`,
    });

    log.ok("Stripe Identity is enabled on this account", {
      session_id: session.id,
      livemode:   session.livemode,
    });

    // Clean up immediately
    await stripe.identity.verificationSessions.cancel(session.id);
    log.info(`Probe session ${session.id} cancelled (cleanup)`);
  } catch (err) {
    if (err.code === "identity_not_enabled" || err.message?.includes("Identity")) {
      log.error(
        "Stripe Identity is NOT enabled. Enable it at: https://dashboard.stripe.com/settings/identity",
        { message: err.message }
      );
    } else {
      log.error("Identity availability check failed", {
        message: err.message,
        code:    err.code,
      });
    }
  }

  // ── 3. Mode check ─────────────────────────────────────────────────────────────
  if (isTestMode) {
    log.info(
      "Running in TEST mode — use Stripe test documents: https://docs.stripe.com/identity/test-mode",
      { key_prefix: "sk_test_" }
    );
  } else {
    log.info("Running in LIVE mode — real identity checks will be performed", {
      key_prefix: "sk_live_",
    });
  }
}
