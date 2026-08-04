import { run as config }      from "./config.js";
import { run as sessions }    from "./sessions.js";
import { run as decisions }   from "./decisions.js";
import { run as reviewLogic } from "./review-logic.js";

export const SUITES = [
  {
    id:          "config",
    label:       "Config & Health",
    description: "Validate Didit API key, workflow ID, and session creation capability",
    run:         config,
  },
  {
    id:          "sessions",
    label:       "Sessions",
    description: "Create, retrieve decision, list, and delete verification sessions",
    run:         sessions,
  },
  {
    id:          "decisions",
    label:       "Decisions",
    description: "Parse and display the full decision payload for a completed session (requires TEST_SESSION_ID)",
    run:         decisions,
  },
  {
    id:          "review-logic",
    label:       "Age & Gender Review Logic",
    description: "Exercise the gender/age mismatch, unknown, underage, and hard-reject-vs-review rules from the production webhook (pure logic, no network calls)",
    run:         reviewLogic,
  },
];

export async function runAll(emit = null) {
  for (const suite of SUITES) {
    if (emit) emit({ level: "suite", message: suite.label });
    await suite.run(emit);
  }
}
