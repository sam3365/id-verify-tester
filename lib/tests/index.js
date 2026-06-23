import { run as config }               from "./config.js";
import { run as verificationSessions } from "./verification-sessions.js";
import { run as verificationReports }  from "./verification-reports.js";

export const SUITES = [
  {
    id:          "config",
    label:       "Config & Health",
    description: "Validate Stripe API key, account access, and Identity feature availability",
    run:         config,
  },
  {
    id:          "verification-sessions",
    label:       "Verification Sessions",
    description: "Create, retrieve, list, cancel, and redact VerificationSessions",
    run:         verificationSessions,
  },
  {
    id:          "verification-reports",
    label:       "Verification Reports",
    description: "List and retrieve VerificationReports (generated after a session is submitted)",
    run:         verificationReports,
  },
];

export async function runAll(emit = null) {
  for (const suite of SUITES) {
    if (emit) emit({ level: "suite", message: suite.label });
    await suite.run(emit);
  }
}
