import { describe, expect, it } from "vitest";
import { jobStatusLabel, jobUiBucket } from "./job-status";

describe("job-status", () => {
  it("buckets partner job statuses", () => {
    expect(jobUiBucket("accepted")).toBe("upcoming");
    expect(jobUiBucket("in_progress")).toBe("active");
    expect(jobUiBucket("completed")).toBe("done");
    expect(jobUiBucket("cancelled")).toBe("ended");
  });

  it("labels partner statuses", () => {
    expect(jobStatusLabel("accepted")).toBe("Assigned");
    expect(jobStatusLabel("in_progress")).toBe("In progress");
    expect(jobStatusLabel("confirmed")).toBe("Awaiting vendor action");
  });
});
