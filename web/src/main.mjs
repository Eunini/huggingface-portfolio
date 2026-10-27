import "@fontsource-variable/manrope";
import "./style.css";
import {
  hotelInitial,
  hotelStep,
  sdrInitial,
  sdrStep,
  sdrCommand,
  ROOMS,
} from "./voice-engine.mjs";
import { scenarios } from "./scenarios.mjs";

const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const hf = "https://huggingface.co";
const kinds = ["adapterlab", "sdr", "hotel"];
let settings = { demo: "adapterlab" };
try {
  settings = await fetch("./demo.json").then((response) =>
    response.ok ? response.json() : settings,
  );
} catch {
  /* Development defaults. */
}
const requested = new URLSearchParams(location.search).get("demo");
const kind = kinds.includes(requested || settings.demo)
  ? requested || settings.demo
  : "adapterlab";
const info = {
  adapterlab: {
    title: "A small model. An inspectable experiment.",
    kicker: "ADAPTERLAB / TEXT CLASSIFICATION",
    description:
      "Try a real LoRA fine-tune of BERT Tiny. Inspect all six scores, the grouped data split and the measured failure cases.",
    name: "AdapterLab inference",
    repo: "adapterlab-inference",
    source: "https://github.com/Eunini/adapterlab",
  },
  sdr: {
    title: "The conversation is only half the system.",
    kicker: "VOICE AI / SALES DEVELOPMENT",
    description:
      "Explore permission, scheduling, follow-up and interruption handling in a public companion to my AI SDR project.",
    name: "AI SDR workflow lab",
    repo: "ai-sdr-workflow-lab",
    source: "https://inioluwa-ai-research.daniell292466.chatgpt.site",
  },
  hotel: {
    title: "A conversation becomes a reservation.",
    kicker: "VOICE AI / HOTEL RECEPTION",
    description:
      "Explore a fictional hotel booking flow with authoritative prices, expiring room holds and verified-payment confirmation.",
    name: "Hotel receptionist workflow lab",
    repo: "hotel-receptionist-lab",
    source:
      "https://inioluwa-ai-research.daniell292466.chatgpt.site/work/voice-reservations",
  },
}[kind];
document.title = `${info.name} · Inioluwa Atanda`;
const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
let theme;
try {
  theme = localStorage.getItem("lab-theme");
} catch {
  /* Storage may be blocked. */
}
document.documentElement.dataset.theme =
  theme || (prefersDark ? "dark" : "light");

$("#app").innerHTML = `
  <a class="skip" href="#main">Skip to demo</a>
  <header class="header"><a class="identity" href="${hf}/Ineeoluwa" target="_blank" rel="noreferrer"><span class="monogram" aria-hidden="true">ia.</span><span>Inioluwa Atanda<span class="identity-sub">Applied AI / public experiments</span></span></a>
    <nav aria-label="External resources"><a href="${info.source}" target="_blank" rel="noreferrer">${kind === "adapterlab" ? "Training source" : "Project portfolio"}</a><a href="${hf}/spaces/Ineeoluwa/${info.repo}/tree/main" target="_blank" rel="noreferrer">Demo source</a><button id="theme" class="subtle">Switch theme</button></nav>
  </header>
  <main id="main">
    <section class="intro"><div><p class="eyebrow">${info.kicker}</p><h1>${info.title}</h1><p class="lead">${info.description}</p></div><p class="edition">PUBLIC LAB<br><span>01 / MODEL SYSTEMS<br>02 / VOICE WORKFLOWS</span></p></section>
    ${kind === "adapterlab" ? modelMarkup() : voiceMarkup()}
  </main>
  <footer><span>Built by <a href="${hf}/Ineeoluwa">Inioluwa Atanda</a></span><span>Inspect the behaviour. Read the limitations. Reproduce the result.</span></footer>`;
$("#theme").addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("lab-theme", next);
  } catch {
    /* Optional preference. */
  }
});

function modelMarkup() {
  return `<div class="metrics"><div><span>Trainable parameters</span><strong>8,966 <small>/ 0.204%</small></strong></div><div><span>Test macro F1</span><strong>0.520 <small>/ 30 examples</small></strong></div><div><span>Execution</span><strong>Your browser <small>/ CPU · WASM</small></strong></div></div>
    <div class="workspace"><section class="panel"><div class="section-heading"><h2>Try a support request</h2><span class="pill">REAL TRAINED WEIGHTS</span></div>
      <p class="muted">English, six synthetic support intents. Inputs stay in this page’s worker; they are not sent to a model server.</p>
      <form id="classify-form"><label for="request">Support request</label><textarea id="request" rows="5" minlength="3" maxlength="1500" required>I cannot sign in after resetting my password.</textarea>
      <div class="example-row" aria-label="Example requests"><button type="button" data-example="Please cancel my monthly subscription.">Cancellation</button><button type="button" data-example="The application crashes when I open a document.">Technical issue</button><button type="button" data-example="Why does my receipt include an extra charge?">Billing</button></div>
      <div class="action-row"><button class="primary" id="classify" type="submit">Load model & classify</button><button class="subtle" id="cancel-inference" type="button" hidden>Cancel</button><span id="model-status" role="status">Model loads on first use.</span></div></form>
      <div id="prediction" aria-live="polite" class="prediction"><p class="empty">All six label scores will appear here.</p></div>
      <p class="fine">First use downloads the model and runtime. Inference truncates to 96 tokens. Scores are softmax outputs, not calibrated confidence.</p>
    </section><aside class="panel evidence-panel"><p class="eyebrow">EXPERIMENT RECORD</p><h2>Small enough to inspect.</h2>
      <dl><div><dt>Base</dt><dd>BERT Tiny · 2 layers / 128 hidden</dd></div><div><dt>Method</dt><dd>LoRA r=8 · query / value + classifier</dd></div><div><dt>Split</dt><dd>180 train / 30 validation / 30 test</dd></div><div><dt>Leakage control</dt><dd>Template families stay in one split</dd></div><div><dt>Training</dt><dd>4 epochs · seed 42 · CPU</dd></div></dl>
      <a class="resource-link" href="${hf}/Ineeoluwa/adapterlab-support-intent-tiny" target="_blank" rel="noreferrer">Model, weights & full card →</a><a class="resource-link" href="${hf}/datasets/Ineeoluwa/support-intent-grouped" target="_blank" rel="noreferrer">Dataset & reproducible splits →</a>
      <div class="boundary"><strong>What the score means</strong><p>This is a small engineering experiment, not a production support classifier. Billing and cancellation each scored zero F1 on the 30-example test. It has no evaluated Yoruba capability.</p></div>
    </aside></div>
    <details class="panel"><summary>Read the evaluation and export checks</summary><div id="evaluation"><p>Loading experiment record…</p></div></details>`;
}

function voiceMarkup() {
  const choices = scenarios.filter((row) => row.project === kind);
  return `<div class="notice"><strong>Public workflow simulator</strong><span>This is a deterministic companion to the private voice system. It does not call an LLM, place calls, send messages or charge money. Optional speech uses your browser’s built-in voice.</span></div>
    <div class="metrics"><div><span>Scenario suite</span><strong>${choices.length} <small>/ replayable cases</small></strong></div><div><span>Current actions</span><strong id="event-count">0 <small>/ auditable events</small></strong></div><div><span>${kind === "hotel" ? "Reservation state" : "Conversation state"}</span><strong id="workflow-state">${kind === "hotel" ? "No hold" : "Permission"}</strong></div></div>
    <div class="workspace voice-workspace"><section class="panel controls"><div class="section-heading"><h2>${kind === "hotel" ? "Run a booking flow" : "Run a conversation flow"}</h2><button id="reset" class="subtle">Reset</button></div>
      ${kind === "hotel" ? hotelControls() : sdrControls()}
      <div class="replay"><label for="scenario">Replay a boundary case</label><select id="scenario">${choices.map((row) => `<option value="${row.id}">${row.title}</option>`).join("")}</select><button class="secondary" id="replay">Replay scenario</button><p class="fine">Replaying resets this sandbox and runs the listed tool events. It measures workflow behaviour, not model quality.</p></div>
    </section><section class="panel trace-panel"><div class="section-heading"><h2>Tool trace</h2><button class="subtle" id="download">Export JSON</button></div><p id="latest-response" class="response" role="status">${kind === "hotel" ? "Choose dates and search for a room to begin." : "I’m an AI assistant in a public demonstration. May I take 20 seconds to explain the workflow?"}</p><div class="speech-controls"><button id="listen" class="subtle">Listen to response</button><button id="stop-speech" class="subtle">Stop speech</button><span id="speech-status" role="status"></span></div><ol class="trace" id="trace"><li class="empty">The exact tool result and state transition will appear here.</li></ol><details class="state-details"><summary>Inspect current state</summary><pre id="state-json"></pre></details></section></div>
    <section class="panel architecture"><div><p class="eyebrow">THE PRIVATE PROJECT</p><h2>${kind === "hotel" ? "Realtime voice, transactional booking." : "Realtime voice, controlled turn-taking."}</h2><p>${kind === "hotel" ? "The hotel system connects a realtime voice session to a booking engine, PostgreSQL holds, payment verification, consented message delivery and staff handoff." : "The SDR implementation includes a phone-media bridge, transcription / speech-to-speech paths, interruption handling and consented follow-up. The public lab isolates the orchestration rules."}</p></div><div><ol class="pipeline">${(kind === "hotel" ? ["Voice / WhatsApp session", "Hotel-scoped context & tool calls", "Price → hold → verified payment", "Reservation / delivery / staff handoff"] : ["Phone media / audio frames", "Transcription or speech-to-speech", "Turn control & interrupted playback", "Permission / calendar / follow-up tools"]).map((value) => `<li>${value}</li>`).join("")}</ol><p class="fine">Provider latency, speech recognition accuracy, payment signatures, identity verification and concurrency across servers are not evaluated by this in-browser simulator.</p><a class="resource-link" href="${hf}/datasets/Ineeoluwa/voice-workflow-scenarios" target="_blank" rel="noreferrer">Open the shared scenario dataset →</a></div></section>`;
}

function hotelControls() {
  return `<form id="search-form"><div class="field-grid"><div><label for="check-in">Check-in</label><input id="check-in" type="date" required value="2026-11-10"></div><div><label for="check-out">Check-out</label><input id="check-out" type="date" required value="2026-11-12"></div></div><label for="room">Room · fictional nightly rate</label><select id="room"><option value="standard">Standard · ₦45,000</option><option value="deluxe">Deluxe · ₦65,000</option></select><button type="submit" class="primary full">1. Search rooms</button></form>
    <div id="offer-summary" class="offer-summary">One fictional room of each type. No guest information is collected.</div><button id="hold" class="secondary full" disabled>2. Hold quoted room</button>
    <label for="channel">Guest-selected delivery channel</label><select id="channel"><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select><label class="checkbox"><input type="checkbox" id="delivery-consent"> Guest agrees to this channel</label><button id="send-link" class="secondary full" disabled>3. Prepare fictional payment link</button><button id="pay" class="primary full" disabled>4. Simulate exact verified payment</button>
    <details class="failure-controls"><summary>Inject a failure</summary><div class="button-stack"><button id="wrong-payment" class="subtle">Send mismatched amount</button><button id="unverified-payment" class="subtle">Send unverified event</button><button id="expire" class="subtle">Advance sandbox by 6 minutes</button><button id="oversell" class="subtle">Try to hold the same room again</button><button id="cancel-unverified" class="subtle">Cancel without identity verification</button></div></details>`;
}

function sdrControls() {
  return `<form id="command-form"><label for="command">Scripted command input</label><input id="command" placeholder="Try: who are you?" maxlength="500" required><button class="primary full" type="submit">Run command</button><p class="fine">A small keyword router maps these commands to workflow events. It is not an AI conversation.</p></form><div class="button-stack"><button class="secondary" data-sdr='{"type":"identify"}'>Ask: are you an AI?</button><button class="secondary" data-sdr='{"type":"permission","allowed":true}'>Allow the conversation</button><button class="secondary" data-sdr='{"type":"offer_slot","calendarAvailable":true}'>Check a fictional meeting time</button><button class="secondary" data-sdr='{"type":"confirm_booking","explicitConfirmation":true,"calendarAvailable":true}'>Explicitly confirm the meeting</button><button class="secondary" data-sdr='{"type":"send_info","channel":"sms","explicitConsent":true}'>Consent to a fictional SMS</button><button class="secondary" data-sdr='{"type":"opt_out"}'>Opt out & end conversation</button></div><details class="failure-controls"><summary>Inspect interruption & failure handling</summary><div class="button-stack"><button class="subtle" data-sdr='{"type":"offer_slot","calendarAvailable":false}'>Simulate calendar failure</button><button class="subtle" data-sdr='{"type":"start_reply"}'>Start an audio reply</button><button class="subtle" data-sdr='{"type":"interrupt"}'>Interrupt the reply</button><button class="subtle" data-sdr='{"type":"audio_chunk","turn":1}'>Deliver a late audio chunk</button></div></details>`;
}

if (kind === "adapterlab") setupModel();
else setupVoice();

function setupModel() {
  let worker;
  let counter = 0;
  let busy = false;
  function complete() {
    busy = false;
    $("#classify").disabled = false;
    $("#classify").textContent = "Classify request";
    $("#cancel-inference").hidden = true;
  }
  $("#cancel-inference").addEventListener("click", () => {
    counter += 1;
    worker?.terminate();
    worker = undefined;
    complete();
    $("#model-status").textContent = "Inference cancelled. You can retry.";
  });
  document.querySelectorAll("[data-example]").forEach((button) =>
    button.addEventListener("click", () => {
      $("#request").value = button.dataset.example;
      $("#request").focus();
    }),
  );
  $("#classify-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy || !event.target.reportValidity()) return;
    busy = true;
    $("#classify").disabled = true;
    $("#cancel-inference").hidden = false;
    $("#model-status").textContent = "Starting inference…";
    if (!worker) {
      worker = new Worker(new URL("./model-worker.mjs", import.meta.url), {
        type: "module",
      });
      worker.onerror = () => {
        $("#model-status").textContent =
          "The worker could not start. Please retry.";
        worker.terminate();
        worker = undefined;
        complete();
      };
      worker.onmessage = ({ data }) => {
        if (data.id !== counter) return;
        if (data.type === "progress") {
          $("#model-status").textContent = data.message;
          return;
        }
        complete();
        if (data.type === "error") {
          $("#model-status").textContent = data.message;
          return;
        }
        $("#model-status").textContent =
          `Inference: ${Math.round(data.milliseconds)} ms on this browser (model load excluded).`;
        $("#prediction").innerHTML =
          `<h3>Prediction: ${escape(data.scores[0].label)}</h3>${data.scores.map((row) => `<div class="score-row"><span>${escape(row.label)}</span><meter min="0" max="1" value="${row.score}" aria-label="${escape(row.label)} softmax score">${row.score}</meter><span>${(row.score * 100).toFixed(1)}%</span></div>`).join("")}`;
      };
    }
    counter += 1;
    worker.postMessage({ id: counter, text: $("#request").value });
  });
  fetch("./experiment.json")
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then((data) => {
      const test = data.evaluation.test;
      $("#evaluation").innerHTML =
        `<p>Measured test accuracy: <strong>${(test.accuracy * 100).toFixed(1)}%</strong>. Macro F1: <strong>${test.macro_f1.toFixed(3)}</strong>. Each label has only five test examples.</p><div class="table-scroll"><table><caption>Per-class performance on the grouped synthetic holdout</caption><thead><tr><th scope="col">Label</th><th scope="col">Precision</th><th scope="col">Recall</th><th scope="col">F1</th><th scope="col">Support</th></tr></thead><tbody>${test.per_class.map((row) => `<tr><th scope="row">${escape(row.label)}</th><td>${row.precision.toFixed(3)}</td><td>${row.recall.toFixed(3)}</td><td>${row.f1.toFixed(3)}</td><td>${row.support}</td></tr>`).join("")}</tbody></table></div><p class="fine">Original training date: ${escape(data.run.trained_at.slice(0, 10))}. ONNX and PyTorch predictions agreed on all ${data.export.test_samples} test examples. These results do not establish production accuracy, multilingual capability or comparisons with a trained head-only baseline.</p>`;
    })
    .catch(() => {
      $("#evaluation").textContent =
        "Experiment record could not load. The complete evaluation is available on the model card.";
    });
  addEventListener("pagehide", () => worker?.terminate());
}

function setupVoice() {
  const initial = kind === "hotel" ? hotelInitial : sdrInitial;
  const step = kind === "hotel" ? hotelStep : sdrStep;
  let state = initial();
  let events = [];
  let lastOffer;
  let lastReservation;
  const stopSpeech = () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  };
  const dispatch = (event) => {
    if (event.type === "opt_out" || event.type === "interrupt") stopSpeech();
    const next = step(state, event);
    state = next.state;
    events.push(structuredClone(event));
    if (next.response.offer) lastOffer = next.response.offer;
    if (next.response.reservation) lastReservation = next.response.reservation;
    $("#latest-response").textContent = next.response.message;
    update();
    return next.response;
  };
  const reset = () => {
    stopSpeech();
    state = initial();
    events = [];
    lastOffer = undefined;
    lastReservation = undefined;
    if (kind === "hotel") $("#delivery-consent").checked = false;
    $("#latest-response").textContent =
      "Sandbox reset. Choose an action or replay a scenario.";
    update();
  };
  function update() {
    $("#event-count").innerHTML =
      `${state.audit.length} <small>/ auditable events</small>`;
    const current = kind === "hotel" ? state.reservations.at(-1) : null;
    $("#workflow-state").textContent =
      kind === "hotel"
        ? current?.status === "held" && current.expiresAt <= state.now
          ? "expired"
          : current?.status || "No hold"
        : state.stage;
    $("#state-json").textContent = JSON.stringify(state, null, 2);
    $("#trace").innerHTML = state.audit.length
      ? state.audit
          .slice()
          .reverse()
          .map(
            (row) =>
              `<li><div><span class="trace-number">${String(row.index).padStart(2, "0")}</span><code>${escape(row.tool || row.event)}</code><span class="result-tag">${row.response.ok ? "ACCEPTED" : "BLOCKED"}</span></div><strong>${escape(row.response.code)}</strong><p>${escape(row.response.message)}</p></li>`,
          )
          .join("")
      : '<li class="empty">The exact tool result and state transition will appear here.</li>';
    if (kind === "hotel") {
      const activeRow = state.reservations.find(
        (row) => row.id === lastReservation?.id,
      );
      const held =
        activeRow?.status === "held" && activeRow.expiresAt > state.now;
      $("#hold").disabled = !lastOffer;
      $("#send-link").disabled = !held;
      $("#pay").disabled = !held;
      $("#offer-summary").textContent = lastOffer
        ? `${lastOffer.nights} nights · ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(lastOffer.totalKobo / 100)} total · ${lastOffer.id} · ${activeRow?.offerId === lastOffer.id ? activeRow.status : "not held"}`
        : "One fictional room of each type. No guest information is collected.";
    }
  }
  $("#reset").addEventListener("click", reset);
  $("#replay").addEventListener("click", () => {
    const scenario = scenarios.find((row) => row.id === $("#scenario").value);
    reset();
    scenario.events.forEach(dispatch);
  });
  $("#download").addEventListener("click", () =>
    download("workflow-trace.json", {
      project: kind,
      simulated: true,
      events,
      state,
    }),
  );
  if (!("speechSynthesis" in window)) {
    $("#listen").disabled = true;
    $("#speech-status").textContent = "Speech is unavailable in this browser.";
  }
  $("#listen").addEventListener("click", () => {
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(
      $("#latest-response").textContent,
    );
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.onstart = () => {
      $("#speech-status").textContent = "Playing the browser’s built-in voice.";
    };
    utterance.onend = () => {
      $("#speech-status").textContent = "Playback finished.";
    };
    utterance.onerror = () => {
      $("#speech-status").textContent =
        "Playback stopped or voice unavailable.";
    };
    speechSynthesis.speak(utterance);
  });
  $("#stop-speech").addEventListener("click", () => {
    stopSpeech();
    $("#speech-status").textContent = "Playback stopped.";
  });
  addEventListener("pagehide", stopSpeech);
  if (kind === "sdr") {
    document
      .querySelectorAll("[data-sdr]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          dispatch(JSON.parse(button.dataset.sdr)),
        ),
      );
    $("#command-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.target.reportValidity()) return;
      dispatch(sdrCommand($("#command").value));
      $("#command").value = "";
    });
  } else {
    const payment = (overrides) => ({
      type: "payment_event",
      eventId: `evt-ui-${events.length + 1}`,
      reservationId: lastReservation?.id || "missing",
      totalKobo: lastReservation?.totalKobo || 0,
      currency: "NGN",
      signatureValid: true,
      ...overrides,
    });
    $("#search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.target.reportValidity())
        dispatch({
          type: "search",
          room: $("#room").value,
          checkIn: $("#check-in").value,
          checkOut: $("#check-out").value,
        });
    });
    $("#hold").addEventListener("click", () =>
      dispatch({
        type: "hold",
        offerId: lastOffer?.id,
        totalKobo: lastOffer?.totalKobo,
      }),
    );
    $("#send-link").addEventListener("click", () =>
      dispatch({
        type: "payment_link",
        reservationId: lastReservation?.id,
        channel: $("#channel").value,
        consent: $("#delivery-consent").checked,
      }),
    );
    $("#pay").addEventListener("click", () => dispatch(payment()));
    $("#wrong-payment").addEventListener("click", () =>
      dispatch(payment({ totalKobo: 1 })),
    );
    $("#unverified-payment").addEventListener("click", () =>
      dispatch(payment({ signatureValid: false })),
    );
    $("#expire").addEventListener("click", () =>
      dispatch({ type: "advance_time", ms: 360000 }),
    );
    $("#oversell").addEventListener("click", () =>
      dispatch({
        type: "hold",
        offerId: lastOffer?.id,
        totalKobo: lastOffer?.totalKobo,
      }),
    );
    $("#cancel-unverified").addEventListener("click", () =>
      dispatch({
        type: "cancel",
        reservationId: lastReservation?.id,
        confirmationCode: lastReservation?.confirmationCode,
        identityVerified: false,
      }),
    );
  }
  update();
}

function download(filename, value) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
