# Inioluwa Atanda · Hugging Face portfolio

Inspectable ML artifacts and public workflow companions for
[Ineeoluwa](https://huggingface.co/Ineeoluwa).

| Release | What runs | Evidence |
|---|---|---|
| [AdapterLab model](https://huggingface.co/Ineeoluwa/adapterlab-support-intent-tiny) | Real BERT Tiny LoRA and merged classifier, plus ONNX | Pinned base/source revisions, original training record, per-class results and export parity |
| [Support Intent Grouped](https://huggingface.co/datasets/Ineeoluwa/support-intent-grouped) | 240 synthetic examples, 48 disjoint template groups | Reproducible 180/30/30 splits and canonical fingerprint |
| [AdapterLab inference](https://huggingface.co/spaces/Ineeoluwa/adapterlab-inference) | Browser-local WASM inference with actual weights | Six scores and measured evaluation, including failures |
| [AI SDR workflow lab](https://huggingface.co/spaces/Ineeoluwa/ai-sdr-workflow-lab) | Deterministic conversation/tool simulator | Permission, opt-out, calendar failure, consented follow-up and interrupted replies |
| [Hotel receptionist lab](https://huggingface.co/spaces/Ineeoluwa/hotel-receptionist-lab) | Fictional reservation/tool simulator | Authoritative offers, expiring holds, exact payment boundaries, replay handling |
| [Voice Workflow Scenarios](https://huggingface.co/datasets/Ineeoluwa/voice-workflow-scenarios) | 34 public regression scenarios | Explicit events, expected outcomes and executable reference engines |

The two voice labs are independent public companions to private projects. They
do not expose private implementation or customer data, run an LLM, place calls,
send messages or charge money. Optional speech uses the browser/OS voice.
Provider signatures, identity and calendar integrations are stubs. The model
release contains an existing real training run with modest results: macro F1
0.5199 on just 30 synthetic test examples. Cards retain those limitations.

## Build and verify

Node 24+ is required for the web build and workflow suite.

```bash
cd web
npm ci --ignore-scripts
npm test
npm run build
npm audit
```

`scripts/assemble.py` packages the original AdapterLab reference run, merges LoRA,
exports float32 ONNX and checks prediction/logit equivalence. It expects the
original `../adapterlab` source and its trained run artifacts. Execute it in that
project's Python 3.12 ML environment with `onnx` and `onnxruntime` installed.
The exact export package versions are recorded in the published model's
`provenance.json`. This script never retrains the model or edits its results.

```bash
node scripts/build-spaces.mjs
python -m pip install -r requirements-release.txt
python scripts/validate_release.py
python -m http.server 4326 --directory releases/adapterlab-space
```

With the static server running:

```bash
cd web
npx playwright install chromium
npm run test:browser
```

Browser checks exercise actual model inference, local asset loading, both voice
workflows, JSON export, mobile overflow, keyboard navigation, both themes and axe
accessibility. `BROWSER_EXECUTABLE` can select an installed Chromium executable.
Validation reports are in `evidence/`; generated binary release folders are
published on Hugging Face rather than duplicated in Git.

## Publish

Authenticate through the Hugging Face CLI's browser flow, outside this source
repository. Credentials stay in the CLI's user cache. No tokens are accepted as
script arguments or stored in this project.

```bash
python scripts/publish.py
python scripts/publish.py --publish
```

The first command is a dry run. Publishing requires the authenticated user to be
exactly `Ineeoluwa`, checks hashes against the validated release, refuses to
overwrite unrelated repositories, and uses the observed parent commit to avoid
clobbering concurrent changes. It creates public static Spaces and a curated
collection without requesting paid compute. All publication dates are actual;
no reconstructed Git history is used here.

## Licensing

Apache-2.0 for code and model artifacts; the BERT base license and attribution are
retained. Synthetic support examples and fictional scenarios are CC0-1.0. Runtime
and font license notices are packaged with each Space.
