/**
 * Heavier UAT read load + optional booking create (gated).
 *
 * Default: parallel vendor/booking reads (safe).
 * Create: set STRESS_ALLOW_CREATE=1 and provide STRESS_VENDOR_ID + STRESS_CUSTOMER_ID
 * (customer row id). Creates a far-future pending_payment row for cleanup in UAT.
 *
 *   npm run stress:k6:booking
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import {
  authHeaders,
  resolveCustomerToken,
  resolveTechnicianToken,
  supabaseConfig,
} from "./lib/config.js";

const allowCreate = (__ENV.STRESS_ALLOW_CREATE || "0").trim() === "1";
const vendorsTrend = new Trend("vendors_duration", true);
const bookingsTrend = new Trend("bookings_duration", true);
const jobsTrend = new Trend("jobs_duration", true);
const httpFailDetail = new Counter("http_fail_detail");

function recordOutcome(name, res, trend) {
  trend.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  if (!ok) {
    httpFailDetail.add(1, { endpoint: name, status: String(res.status || 0) });
    console.error(
      `[${name}] status=${res.status} err=${res.error || ""} body=${String(res.body || "").slice(0, 240)}`,
    );
  }
  return ok;
}

export const options = {
  scenarios: {
    load: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || "5m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<3000"],
    vendors_duration: ["p(95)<3000"],
    bookings_duration: ["p(95)<3000"],
    jobs_duration: ["p(95)<3000"],
  },
};

export function setup() {
  const { url, anon } = supabaseConfig();
  return {
    url,
    anon,
    customerToken: resolveCustomerToken(http, url, anon),
    technicianToken: resolveTechnicianToken(http, url, anon),
  };
}

export default function (data) {
  const cust = authHeaders(data.customerToken, data.anon);
  const tech = authHeaders(data.technicianToken, data.anon);

  const batch = http.batch([
    [
      "GET",
      `${data.url}/rest/v1/vendors?select=id,business_name&approval_status=eq.approved&limit=100`,
      null,
      { headers: cust, tags: { name: "vendors_batch" }, timeout: "60s" },
    ],
    [
      "GET",
      `${data.url}/rest/v1/bookings?select=id,status,reference_code&limit=50`,
      null,
      { headers: cust, tags: { name: "bookings_batch" }, timeout: "60s" },
    ],
    [
      "GET",
      `${data.url}/rest/v1/bookings?select=id,status&limit=50`,
      null,
      { headers: tech, tags: { name: "jobs_batch" }, timeout: "60s" },
    ],
  ]);

  check(batch[0], { "vendors ok": (r) => recordOutcome("vendors", r, vendorsTrend) });
  check(batch[1], { "bookings ok": (r) => recordOutcome("bookings", r, bookingsTrend) });
  check(batch[2], { "jobs ok": (r) => recordOutcome("jobs", r, jobsTrend) });

  if (allowCreate) {
    const vendorId = (__ENV.STRESS_VENDOR_ID || "").trim();
    const customerId = (__ENV.STRESS_CUSTOMER_ID || "").trim();
    if (vendorId && customerId) {
      const start = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const ref = `OM-STRESS${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
      const payload = {
        reference_code: ref,
        customer_id: customerId,
        vendor_id: vendorId,
        status: "pending_payment",
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        payment_timing: "postpaid",
        currency: "INR",
        estimated_price_cents: 10000,
        metadata: { source: "k6_stress", request_kind: "visit" },
        service_site_address: {
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          country: "India",
          line1: "k6 stress site",
          formatted: "k6 stress site\nBengaluru, Karnataka\n560001",
        },
      };
      const created = http.post(`${data.url}/rest/v1/bookings`, JSON.stringify(payload), {
        headers: { ...cust, Prefer: "return=minimal" },
        tags: { name: "create_booking" },
      });
      check(created, {
        "create booking accepted or forbidden": (r) =>
          r.status === 201 || r.status === 200 || r.status === 403 || r.status === 401,
      });
    }
  }

  sleep(0.3);
}
