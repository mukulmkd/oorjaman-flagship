import { describe, expect, it } from "vitest";
import { formatElapsed } from "./job-timer";

describe("formatElapsed", () => {
  it("formats h:mm:ss", () => {
    expect(formatElapsed(0)).toBe("0:00:00");
    expect(formatElapsed(1000)).toBe("0:00:01");
    expect(formatElapsed(61_000)).toBe("0:01:01");
    expect(formatElapsed(3_661_000)).toBe("1:01:01");
  });
});
