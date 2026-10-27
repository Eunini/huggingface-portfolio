// Public, deterministic workflow companions. No provider adapters or live data.
const clone = (value) => structuredClone(value);
const result = (ok, code, message, details = {}) => ({
  ok,
  code,
  message,
  ...details,
});
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const overlap = (a, b) => a.checkIn < b.checkOut && b.checkIn < a.checkOut;
export const ROOMS = Object.freeze({ standard: 4500000, deluxe: 6500000 });

export function hotelInitial() {
  return {
    now: 0,
    sequence: 0,
    offers: [],
    reservations: [],
    payments: {},
    audit: [],
  };
}

export function hotelStep(previous, event) {
  const state = clone(previous);
  let response;
  const id = (prefix) => `${prefix}-${++state.sequence}`;
  const active = (row) =>
    row.status === "confirmed" ||
    (row.status === "held" && row.expiresAt > state.now);
  const available = (stay) =>
    !state.reservations.some(
      (row) => active(row) && row.room === stay.room && overlap(row, stay),
    );
  if (event.type === "advance_time") {
    if (
      !Number.isSafeInteger(event.ms) ||
      event.ms < 0 ||
      event.ms > 86400000
    ) {
      response = result(
        false,
        "invalid_time",
        "Use a non-negative time advance of at most one day.",
      );
    } else {
      state.now += event.ms;
      response = result(
        true,
        "time_advanced",
        "The sandbox clock advanced. Expired holds no longer reserve inventory.",
      );
    }
  } else if (event.type === "search") {
    const nights =
      (Date.parse(`${event.checkOut}T00:00:00Z`) -
        Date.parse(`${event.checkIn}T00:00:00Z`)) /
      86400000;
    if (
      !validDate(event.checkIn) ||
      !validDate(event.checkOut) ||
      !Number.isInteger(nights) ||
      nights < 1 ||
      nights > 14 ||
      !Object.hasOwn(ROOMS, event.room)
    ) {
      response = result(
        false,
        "invalid_stay",
        "Choose a room and a stay of 1–14 nights with valid dates.",
      );
    } else if (!available(event)) {
      response = result(
        false,
        "sold_out",
        "The last room is already held or confirmed for these dates.",
      );
    } else {
      const offer = {
        id: id("offer"),
        room: event.room,
        checkIn: event.checkIn,
        checkOut: event.checkOut,
        nights,
        totalKobo: ROOMS[event.room] * nights,
        currency: "NGN",
        expiresAt: state.now + 120000,
      };
      state.offers.push(offer);
      response = result(
        true,
        "offer_created",
        "A server-priced fictional offer is ready.",
        { offer },
      );
    }
  } else if (event.type === "hold") {
    const offer = state.offers.find((row) => row.id === event.offerId);
    if (!offer || offer.expiresAt <= state.now) {
      response = result(
        false,
        "stale_offer",
        "This offer has expired or does not exist. Search again.",
      );
    } else if (event.totalKobo !== offer.totalKobo) {
      response = result(
        false,
        "price_mismatch",
        "The requested amount differs from the authoritative offer.",
      );
    } else if (!available(offer)) {
      response = result(
        false,
        "sold_out",
        "Another guest holds the last room. No second hold was created.",
      );
    } else {
      const reservation = {
        ...offer,
        offerId: offer.id,
        id: id("stay"),
        status: "held",
        expiresAt: state.now + 300000,
        confirmationCode: null,
        delivery: null,
      };
      state.reservations.push(reservation);
      response = result(
        true,
        "hold_created",
        "Room held for five sandbox minutes. This is not a confirmed booking.",
        { reservation },
      );
    }
  } else if (event.type === "payment_link") {
    const row = state.reservations.find(
      (row) => row.id === event.reservationId,
    );
    if (!row || row.status !== "held" || row.expiresAt <= state.now) {
      response = result(
        false,
        "inactive_hold",
        "A current, unconfirmed hold is required.",
      );
    } else if (
      !["sms", "whatsapp"].includes(event.channel) ||
      event.consent !== true
    ) {
      response = result(
        false,
        "consent_required",
        "The guest must explicitly choose and consent to one delivery channel.",
      );
    } else if (row.delivery) {
      response = result(
        true,
        "delivery_exists",
        "The existing simulated delivery is reused. No duplicate is created.",
        { delivery: row.delivery },
      );
    } else {
      row.delivery = {
        channel: event.channel,
        url: `https://example.invalid/pay/${row.id}`,
        simulated: true,
      };
      response = result(
        true,
        "link_prepared",
        "A fictional link was prepared. No SMS, WhatsApp message or payment request was sent.",
        { delivery: row.delivery },
      );
    }
  } else if (event.type === "payment_event") {
    const row = state.reservations.find(
      (row) => row.id === event.reservationId,
    );
    const key = typeof event.eventId === "string" ? event.eventId : "";
    const signature = JSON.stringify([
      event.reservationId,
      event.totalKobo,
      event.currency,
    ]);
    if (event.signatureValid !== true) {
      response = result(
        false,
        "signature_rejected",
        "The provider-verification stub rejected this event.",
      );
    } else if (!/^evt-[a-zA-Z0-9-]{1,64}$/.test(key)) {
      response = result(
        false,
        "invalid_event_id",
        "A bounded payment event identifier is required.",
      );
    } else if (Object.hasOwn(state.payments, key)) {
      response =
        state.payments[key] === signature
          ? result(
              true,
              "duplicate_event",
              "This event was already handled. Inventory and booking state are unchanged.",
            )
          : result(
              false,
              "event_conflict",
              "An event identifier cannot be reused with different payment details.",
            );
    } else if (!row || row.status !== "held" || row.expiresAt <= state.now) {
      response = result(
        false,
        "reconciliation_required",
        "No active hold matches this payment. Staff reconciliation is required.",
      );
    } else if (event.totalKobo !== row.totalKobo || event.currency !== "NGN") {
      response = result(
        false,
        "payment_mismatch",
        "Amount or currency mismatch. The booking remains unconfirmed.",
      );
    } else {
      state.payments[key] = signature;
      row.status = "confirmed";
      row.confirmationCode = `DEMO-${row.id.toUpperCase()}`;
      response = result(
        true,
        "booking_confirmed",
        "The fictional reservation is confirmed after an exact verified event.",
        { reservation: row },
      );
    }
  } else if (event.type === "cancel") {
    const row = state.reservations.find(
      (row) => row.id === event.reservationId,
    );
    if (
      !row ||
      !row.confirmationCode ||
      row.confirmationCode !== event.confirmationCode ||
      event.identityVerified !== true
    ) {
      response = result(
        false,
        "verification_required",
        "The reservation code and a successful identity-verification stub are required.",
      );
    } else if (row.status === "cancelled") {
      response = result(
        true,
        "already_cancelled",
        "The reservation was already cancelled.",
      );
    } else {
      row.status = "cancelled";
      response = result(
        true,
        "booking_cancelled",
        "The fictional reservation is cancelled. No real refund was issued.",
      );
    }
  } else if (event.type === "handoff") {
    response = result(
      true,
      "staff_handoff",
      "A simulated staff request was recorded. No staff member was contacted.",
    );
  } else {
    response = result(
      false,
      "unknown_tool",
      "This sandbox does not allow that tool.",
    );
  }
  state.audit.push({
    index: state.audit.length + 1,
    at: state.now,
    tool: event.type,
    response: clone(response),
  });
  return { state, response };
}

export function sdrInitial() {
  return {
    stage: "permission",
    consent: false,
    optedOut: false,
    speaking: false,
    turn: 0,
    activeReply: null,
    booking: null,
    messages: [],
    audit: [],
  };
}

export function sdrStep(previous, event) {
  const state = clone(previous);
  let response;
  if (event.type === "opt_out") {
    state.optedOut = true;
    state.consent = false;
    state.stage = "ended";
    state.activeReply = null;
    state.speaking = false;
    response = result(
      true,
      "suppressed",
      "Understood. I’ll end this conversation and mark this sandbox contact as opted out.",
    );
  } else if (state.optedOut || state.stage === "ended") {
    response = result(
      false,
      "conversation_closed",
      "The conversation is closed. Further outreach is blocked in this sandbox.",
    );
  } else if (event.type === "identify") {
    response = result(
      true,
      "ai_disclosed",
      "I’m an AI assistant in a public demonstration. May I explain why I’m calling?",
    );
  } else if (event.type === "permission") {
    if (event.allowed !== true) {
      state.stage = "ended";
      response = result(
        true,
        "permission_declined",
        "No problem. Thank you for your time. Goodbye.",
      );
    } else {
      state.consent = true;
      state.stage = "discovery";
      response = result(
        true,
        "permission_granted",
        "Thank you. How does your team currently handle a new inquiry?",
      );
    }
  } else if (!state.consent) {
    response = result(
      false,
      "permission_required",
      "Ask for permission before discovery, scheduling or follow-up.",
    );
  } else if (event.type === "discovery") {
    response = result(
      true,
      "discovery",
      "Would a short walkthrough of the inquiry-handling workflow be useful? No customer or conversion claims are assumed.",
    );
    state.stage = "qualification";
  } else if (event.type === "offer_slot") {
    if (event.calendarAvailable !== true) {
      response = result(
        false,
        "calendar_unavailable",
        "The sandbox calendar is unavailable. A meeting cannot be promised.",
      );
    } else {
      state.stage = "scheduling";
      response = result(
        true,
        "slot_offered",
        "The fictional calendar has Tuesday at 14:00 UTC. Shall I reserve that time?",
      );
    }
  } else if (event.type === "confirm_booking") {
    if (
      state.stage !== "scheduling" ||
      event.explicitConfirmation !== true ||
      event.calendarAvailable !== true
    ) {
      response = result(
        false,
        "confirmation_required",
        "An offered slot, explicit confirmation and a successful calendar stub are required.",
      );
    } else {
      state.booking = {
        id: "meeting-demo-1",
        start: "Tuesday 14:00 UTC",
        simulated: true,
      };
      state.stage = "booked";
      response = result(
        true,
        "meeting_recorded",
        "The fictional meeting is recorded. No calendar invitation was sent.",
        { booking: state.booking },
      );
    }
  } else if (event.type === "send_info") {
    if (
      event.explicitConsent !== true ||
      !["sms", "email"].includes(event.channel)
    ) {
      response = result(
        false,
        "delivery_consent_required",
        "Ask permission for the selected channel before preparing follow-up.",
      );
    } else if (state.messages.some((row) => row.channel === event.channel)) {
      response = result(
        true,
        "followup_exists",
        "The existing fictional follow-up is reused.",
      );
    } else {
      state.messages.push({ channel: event.channel, simulated: true });
      response = result(
        true,
        "followup_prepared",
        "A fictional follow-up is prepared with an opt-out path. Nothing was sent.",
      );
    }
  } else if (event.type === "start_reply") {
    state.activeReply = ++state.turn;
    state.speaking = true;
    response = result(
      true,
      "reply_started",
      "Playback has an active turn identifier.",
      { turn: state.turn },
    );
  } else if (event.type === "interrupt") {
    state.activeReply = null;
    state.speaking = false;
    response = result(
      true,
      "playback_cancelled",
      "The active reply was cancelled and the playback queue was cleared.",
    );
  } else if (event.type === "audio_chunk") {
    response =
      state.activeReply !== null && event.turn === state.activeReply
        ? result(true, "chunk_accepted", "Audio belongs to the active reply.")
        : result(
            false,
            "stale_audio_dropped",
            "Late audio from a cancelled or older turn was discarded.",
          );
  } else {
    response = result(
      false,
      "unknown_tool",
      "This sandbox does not allow that action.",
    );
  }
  state.audit.push({
    index: state.audit.length + 1,
    event: event.type,
    response: clone(response),
  });
  return { state, response };
}

// Small command router for the demo UI, explicitly not an LLM or an NLU benchmark.
export function sdrCommand(text) {
  const value = text.trim().toLowerCase();
  if (/\b(stop|remove|opt out|do not call|don't call)\b/.test(value))
    return { type: "opt_out" };
  if (/\b(who|robot|ai|human)\b/.test(value)) return { type: "identify" };
  if (/^(no|not interested|not now)\b/.test(value))
    return { type: "permission", allowed: false };
  if (/^(yes|sure|go ahead|okay|ok)\b/.test(value))
    return { type: "permission", allowed: true };
  if (/\b(book|confirm)\b/.test(value))
    return {
      type: "confirm_booking",
      explicitConfirmation: true,
      calendarAvailable: true,
    };
  if (/\b(meeting|schedule|time)\b/.test(value))
    return { type: "offer_slot", calendarAvailable: true };
  if (/\b(email|sms|text)\b/.test(value))
    return {
      type: "send_info",
      explicitConsent: false,
      channel: /email/.test(value) ? "email" : "sms",
    };
  return { type: "discovery" };
}
