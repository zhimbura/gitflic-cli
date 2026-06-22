import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We don't mock die() here because format.mjs doesn't export it from a
// separately-mockable surface — keep these tests focused on color logic.

import { color, shouldUseColor, setColorEnabled } from "../format.mjs";

let prevNoColor;
let prevForceColor;
let prevUseColor;
let origIsTTY;

beforeEach(() => {
  prevNoColor = process.env.NO_COLOR;
  prevForceColor = process.env.FORCE_COLOR;
  // Reset lazy-resolved _useColor by toggling it via the public API.
  setColorEnabled(false);
  origIsTTY = process.stdout.isTTY;
});

afterEach(() => {
  if (prevNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = prevNoColor;
  if (prevForceColor === undefined) delete process.env.FORCE_COLOR;
  else process.env.FORCE_COLOR = prevForceColor;
  setColorEnabled(null);
  // restore isTTY if we faked it
  Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true });
});

function fakeTTY(value) {
  Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
}

describe("color()", () => {
  it("emits ANSI when useColor is true", () => {
    setColorEnabled(true);
    expect(color("hi", 31)).toBe("\x1b[31mhi\x1b[0m");
  });

  it("returns plain string when useColor is false", () => {
    setColorEnabled(false);
    expect(color("hi", 31)).toBe("hi");
  });
});

describe("shouldUseColor() — env-driven", () => {
  it("NO_COLOR=1 disables even when TTY", () => {
    setColorEnabled(null);
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    fakeTTY(true);
    process.env.NO_COLOR = "1";
    expect(shouldUseColor()).toBe(false);
  });

  it("NO_COLOR=0 still disables (any value, per spec)", () => {
    setColorEnabled(null);
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    fakeTTY(true);
    process.env.NO_COLOR = "0";
    expect(shouldUseColor()).toBe(false);
  });

  it("FORCE_COLOR=1 enables even in non-TTY", () => {
    setColorEnabled(null);
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    fakeTTY(false);
    process.env.FORCE_COLOR = "1";
    expect(shouldUseColor()).toBe(true);
  });

  it("default: TTY=true enables, TTY=false disables", () => {
    setColorEnabled(null);
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    fakeTTY(true);
    expect(shouldUseColor()).toBe(true);
    fakeTTY(false);
    setColorEnabled(null);
    expect(shouldUseColor()).toBe(false);
  });
});

describe("setColorEnabled() override", () => {
  it("overrides env and TTY detection", () => {
    setColorEnabled(null);
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    fakeTTY(false);
    setColorEnabled(true);
    expect(shouldUseColor()).toBe(true);
    setColorEnabled(false);
    expect(shouldUseColor()).toBe(false);
  });
});
