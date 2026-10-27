import test from "node:test";
import assert from "node:assert/strict";
import {
  hotelInitial,
  hotelStep,
  sdrInitial,
  sdrStep,
  sdrCommand,
} from "../web/src/voice-engine.mjs";
import { scenarios } from "../web/src/scenarios.mjs";

for (const scenario of scenarios) {
  test(scenario.title, () => {
    const step = scenario.project === "hotel" ? hotelStep : sdrStep;
    let state = scenario.project === "hotel" ? hotelInitial() : sdrInitial();
    const actual = [];
    for (const event of scenario.events) {
      const before = structuredClone(state);
      const next = step(state, event);
      assert.deepEqual(
        state,
        before,
        "Each transition preserves its input state",
      );
      state = next.state;
      actual.push(next.response.code);
    }
    assert.deepEqual(actual, scenario.expected);
    assert.equal(state.audit.length, scenario.events.length);
    if (scenario.project === "hotel") {
      const confirmed = state.reservations.filter(
        (row) => row.status === "confirmed",
      );
      for (const row of confirmed) {
        assert.ok(row.confirmationCode);
        assert.ok(
          Object.values(state.payments).some(
            (value) => JSON.parse(value)[0] === row.id,
          ),
        );
      }
    } else if (state.optedOut) {
      assert.equal(state.activeReply, null);
      assert.equal(state.speaking, false);
      assert.equal(state.consent, false);
    }
  });
}

test("unknown tools cannot mutate reservations", () => {
  const initial = hotelInitial();
  const { state, response } = hotelStep(initial, {
    type: "force_confirm",
    reservationId: "stay-2",
  });
  assert.equal(response.code, "unknown_tool");
  assert.deepEqual(state.reservations, []);
});

test("command router prioritizes opt-out over scheduling words", () => {
  assert.equal(
    sdrCommand("Do not call me about another meeting").type,
    "opt_out",
  );
  assert.equal(sdrCommand("Send an email").explicitConsent, false);
});

test("date, amount and clock boundaries fail closed", () => {
  for (const ms of [-1, Infinity, NaN, 1.5, 86400001]) {
    const { state, response } = hotelStep(hotelInitial(), {
      type: "advance_time",
      ms,
    });
    assert.equal(response.ok, false);
    assert.equal(state.now, 0);
  }
  for (const room of ["__proto__", "constructor", "penthouse"]) {
    assert.equal(
      hotelStep(hotelInitial(), {
        type: "search",
        room,
        checkIn: "2026-11-10",
        checkOut: "2026-11-12",
      }).response.code,
      "invalid_stay",
    );
  }
});
