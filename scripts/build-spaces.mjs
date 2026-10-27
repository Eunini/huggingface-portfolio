import { cp, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { scenarios } from "../web/src/scenarios.mjs";
import {
  hotelInitial,
  hotelStep,
  sdrInitial,
  sdrStep,
} from "../web/src/voice-engine.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "web");
const releases = resolve(root, "releases");
const result = spawnSync("npm", ["run", "build"], {
  cwd: web,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status || 1);
const model = resolve(releases, "model");
const evaluation = JSON.parse(
  await readFile(resolve(model, "evaluation.json")),
);
const run = JSON.parse(await readFile(resolve(model, "run.json")));
const exported = JSON.parse(
  await readFile(resolve(model, "export_verification.json")),
);
const license = await readFile(resolve(model, "LICENSE"));
await writeFile(resolve(root, "LICENSE"), license);
const definitions = [
  {
    kind: "adapterlab",
    folder: "adapterlab-space",
    title: "AdapterLab · browser inference",
    slug: "adapterlab-inference",
    description:
      "A real LoRA-trained BERT Tiny classifier, merged and exported to ONNX for browser CPU inference. Includes the measured evaluation, per-class failures, dataset link and training provenance. English synthetic data, 30-example test, macro F1 0.5199; experimental, not production accuracy.",
    extra:
      "models:\n  - Ineeoluwa/adapterlab-support-intent-tiny\ndatasets:\n  - Ineeoluwa/support-intent-grouped\n",
  },
  {
    kind: "sdr",
    folder: "sdr-space",
    title: "AI SDR · workflow lab",
    slug: "ai-sdr-workflow-lab",
    description:
      "An inspectable deterministic companion to Inioluwa Atanda’s private AI SDR voice project. Replay permission, opt-out, scheduling, consented follow-up and interrupted audio turns. This lab does not run an LLM or telephony provider, send messages or create real meetings. Optional playback uses browser speech synthesis, not the private system’s voice.",
    extra: "datasets:\n  - Ineeoluwa/voice-workflow-scenarios\n",
  },
  {
    kind: "hotel",
    folder: "hotel-space",
    title: "Hotel receptionist · workflow lab",
    slug: "hotel-receptionist-lab",
    description:
      "A fictional booking workflow companion to Inioluwa Atanda’s private hotel voice receptionist project. Inspect priced offers, expiring inventory holds, exact verified-payment events, consented link delivery and safe cancellation boundaries. Provider-signature and identity checks are stubs. No calls, messages, money or real bookings are involved; this single-threaded simulator does not establish database concurrency safety.",
    extra: "datasets:\n  - Ineeoluwa/voice-workflow-scenarios\n",
  },
];
for (const definition of definitions) {
  const folder = resolve(releases, definition.folder);
  await rm(folder, { recursive: true, force: true });
  await cp(resolve(web, "dist"), folder, { recursive: true });
  await writeFile(
    resolve(folder, "demo.json"),
    JSON.stringify({ demo: definition.kind }),
  );
  await writeFile(resolve(folder, "LICENSE"), license);
  await mkdir(resolve(folder, "source/web"), { recursive: true });
  await cp(resolve(web, "src"), resolve(folder, "source/web/src"), {
    recursive: true,
  });
  await cp(resolve(web, "tests"), resolve(folder, "source/web/tests"), {
    recursive: true,
  });
  for (const filename of [
    "index.html",
    "package.json",
    "package-lock.json",
    "vite.config.mjs",
    "playwright.config.mjs",
  ]) {
    await cp(resolve(web, filename), resolve(folder, "source/web", filename));
  }
  await cp(resolve(root, "tests"), resolve(folder, "source/tests"), {
    recursive: true,
  });
  await writeFile(
    resolve(folder, "README.md"),
    `---\ntitle: ${definition.title}\nemoji: ${definition.kind === "hotel" ? "🏨" : definition.kind === "sdr" ? "🎙️" : "🔬"}\ncolorFrom: gray\ncolorTo: blue\nsdk: static\napp_file: index.html\nlicense: apache-2.0\nshort_description: ${definition.kind === "adapterlab" ? "Real LoRA weights, local browser inference and measured evaluation" : "Inspectable voice-agent tools, boundaries and replayable scenarios"}\n${definition.extra}tags:\n  - portfolio\n  - ${definition.kind === "adapterlab" ? "onnx" : "voice-agents"}\n  - reproducible-research\n---\n\n# ${definition.title}\n\n${definition.description}\n\nBuilt by **Inioluwa Atanda**. [Portfolio](https://inioluwa-ai-research.daniell292466.chatgpt.site) · [GitHub](https://github.com/Eunini).\n\n## Run and inspect\n\nThis is a static HTML Space. Compiled assets, model files (for AdapterLab), inference runtime and fonts are served from this repository. No API keys or paid inference are required.\n\nTo serve the published build locally:\n\n\`\`\`bash\npython -m http.server 4326\n\`\`\`\n\nOpen http://localhost:4326. The unbundled UI and shared reference engine are in \`source/web/src\`. The full shared suite runs with Node 24+: \`node --test source/tests/workflows.test.mjs\`. To rebuild the UI: \`cd source/web && npm ci && npm run build\`; the repository's shipped runtime/model folders must be retained alongside the resulting assets. The release assembler and Python model exporter are available in [the source repository](https://github.com/Eunini/huggingface-portfolio).\n\n## Data and boundaries\n\n${definition.kind === "adapterlab" ? "Typed requests stay in the browser worker. The model and runtime are fetched from this Space, with remote model fetching disabled. No inference telemetry is added. Model scores are not calibrated. The full model card contains scope, licenses and the original training date." : "All inventory, dates, prices and meetings are synthetic. Typed commands use a small keyword router, not an LLM. Speech synthesis is optional and uses the browser/OS voice implementation, whose voice availability and network behaviour depend on the browser. No microphone recording is requested. A JSON trace can be exported locally. The source private system and public simulator have different runtime and verification boundaries."}\n\n## Licenses\n\nApache-2.0 for this implementation. Third-party notices are under \`licenses/\`. Synthetic scenario examples are CC0-1.0; they are public regression cases, not an independent hidden benchmark.\n`,
  );
  await mkdir(resolve(folder, "licenses"), { recursive: true });
  const packages = [
    "@huggingface/transformers",
    "@huggingface/jinja",
    "@huggingface/tokenizers",
    "onnxruntime-web",
    "onnxruntime-common",
    "@fontsource-variable/manrope",
  ];
  for (const name of packages) {
    const packageRoot = resolve(web, "node_modules", name);
    const files = await readdir(packageRoot);
    for (const file of files.filter((file) =>
      /^(LICENSE|OFL|NOTICE)/i.test(file),
    )) {
      await cp(
        resolve(packageRoot, file),
        resolve(folder, "licenses", `${name.replaceAll("/", "__")}-${file}`),
      );
    }
  }
  if (definition.kind === "adapterlab") {
    const targetModel = resolve(folder, "models/support-intent-tiny");
    await mkdir(resolve(targetModel, "onnx"), { recursive: true });
    for (const file of [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "LICENSE",
    ]) {
      await cp(resolve(model, file), resolve(targetModel, file));
    }
    await cp(
      resolve(model, "onnx/model.onnx"),
      resolve(targetModel, "onnx/model.onnx"),
    );
    const runtime = resolve(folder, "runtime");
    await mkdir(runtime, { recursive: true });
    const dist = resolve(web, "node_modules/onnxruntime-web/dist");
    for (const file of (await readdir(dist)).filter((file) =>
      /^ort-wasm.*\.(wasm|mjs)$/.test(file),
    )) {
      await cp(resolve(dist, file), resolve(runtime, file));
    }
    await writeFile(
      resolve(folder, "experiment.json"),
      JSON.stringify({ evaluation, run, export: exported }),
    );
  }
}
const records = scenarios.map(({ events, expected, ...scenario }) => ({
  ...scenario,
  events_json: JSON.stringify(events),
  expected_codes: expected,
}));
await writeFile(
  resolve(releases, "voice-dataset/scenarios.jsonl"),
  records.map((row) => JSON.stringify(row)).join("\n") + "\n",
);
const evaluations = scenarios.map((scenario) => {
  const step = scenario.project === "hotel" ? hotelStep : sdrStep;
  let state = scenario.project === "hotel" ? hotelInitial() : sdrInitial();
  const observed = [];
  for (const event of scenario.events) {
    const next = step(state, event);
    state = next.state;
    observed.push(next.response.code);
  }
  return {
    id: scenario.id,
    project: scenario.project,
    passed: JSON.stringify(observed) === JSON.stringify(scenario.expected),
    expected_codes: scenario.expected,
    observed_codes: observed,
  };
});
if (evaluations.some((row) => !row.passed))
  throw new Error("Scenario regression");
await writeFile(
  resolve(root, "evidence/scenarios.json"),
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      scope: "deterministic public reference engine only",
      total: evaluations.length,
      passed: evaluations.length,
      cases: evaluations,
    },
    null,
    2,
  ),
);
for (const folder of ["sdr-space", "hotel-space"]) {
  await cp(
    resolve(root, "evidence/scenarios.json"),
    resolve(releases, folder, "scenario-results.json"),
  );
}
console.log(
  `Built ${definitions.length} static Spaces and ${records.length} replayable scenarios.`,
);
