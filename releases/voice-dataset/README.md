---
language: en
license: cc0-1.0
task_categories:
  - other
size_categories:
  - n<1K
tags:
  - voice-agents
  - tool-calling
  - agent-evaluation
  - synthetic
  - workflow-testing
configs:
  - config_name: default
    data_files:
      - split: test
        path: scenarios.jsonl
---

# Voice Workflow Scenarios

**34 explicit, synthetic regression scenarios** for two public workflow labs by
Inioluwa Atanda: an [AI SDR](https://huggingface.co/spaces/Ineeoluwa/ai-sdr-workflow-lab)
and a [hotel receptionist](https://huggingface.co/spaces/Ineeoluwa/hotel-receptionist-lab).

The public labs are deterministic companions to private voice applications.
They isolate tool orchestration for inspection without disclosing customer data,
provider credentials or private source code. They do not run a speech model or
place calls. Dates, prices, inventory, meetings and identifiers are fictional.

## Coverage

| Project | Cases | Boundaries |
|---|---:|---|
| Hotel receptionist | 20 | Server-priced offers, last-room competition, hold expiry, exact payment amount/currency, verified-event stub, event replay, channel consent, cancellation verification stub, staff handoff |
| AI SDR | 14 | Permission, AI disclosure, opt-out, calendar failure, explicit meeting confirmation, follow-up consent, interrupted playback and late audio chunks |

## Schema and replay

- `id`: stable scenario identifier.
- `project`: `hotel` or `sdr`.
- `title`: scenario intent.
- `events_json`: JSON-encoded ordered tool events, parsed with `json.loads`.
- `expected_codes`: expected response code after every event.
- `tags`: covered behaviour.

All cases start from a fresh sandbox state. Hotel time begins at zero and advances
only through `advance_time` events. The source, test runner and scenario definitions
are included in both Space repositories under `source/`. Run `node --test
source/tests/workflows.test.mjs` from the Space root to execute the shared suite.
The demo's JSON export records actual local events and state for inspection.

```python
import json
from datasets import load_dataset

cases = load_dataset("Ineeoluwa/voice-workflow-scenarios", split="test")
print(json.loads(cases[0]["events_json"]))
print(cases[0]["expected_codes"])
```

## What this evaluates

These are public regression cases paired with explicit expected outcomes, not a
hidden benchmark. Passing them demonstrates the in-browser reference engine's
behaviour on those cases. It does not measure an LLM's tool selection, speech
recognition, end-to-end voice quality, provider latency or the private deployment.
Payment-signature and identity-verification inputs are **stubs**, not cryptographic
verification. The single-threaded demo does not prove database concurrency safety.
The suite has no human-call recordings, customer transcripts or external actions.

Created and evaluated in October 2026. CC0-1.0 applies to these fictional scenarios;
the executable reference implementation has its separate Apache-2.0 license.
