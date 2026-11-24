/**
 * UAT smoke: login + read-heavy paths (vendors, customer bookings, technician jobs).
 *
 *   npm run stress:k6:smoke
 *   k6 run -e SUPABASE_URL=... stress/k6/smoke.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import {
  authHeaders,
  resolveCustomerToken,
  resolveTechnicianToken,
  supabaseConfig,
} from "./lib/config.js";

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 5),
      duration: __ENV.DURATION || "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export function setup() {
  const { url, anon } = supabaseConfig();
  const customerToken = resolveCustomerToken(http, url, anon);
  const technicianToken = resolveTechnicianToken(http, url, anon);
  return { url, anon, customerToken, technicianToken };
}

export default function (data) {
  const cust = authHeaders(data.customerToken, data.anon);
  const tech = authHeaders(data.technicianToken, data.anon);

  const vendors = http.get(
    `${data.url}/rest/v1/vendors?select=id,business_name,approval_status&approval_status=eq.approved&limit=50`,
    { headers: cust, tags: { name: "list_approved_vendors" } },
  );
  check(vendors, { "vendors 2xx": (r) => r.status >= 200 && r.status < 300 });

  const bookings = http.get(
    `${data.url}/rest/v1/bookings?select=id,reference_code,status,scheduled_start&order=scheduled_start.desc&limit=30`,
    { headers: cust, tags: { name: "list_customer_bookings" } },
  );
  check(bookings, { "customer bookings 2xx": (r) => r.status >= 200 && r.status < 300 });

  const jobs = http.get(
    `${data.url}/rest/v1/bookings?select=id,reference_code,status,scheduled_start,technician_id&order=scheduled_start.asc&limit=30`,
    { headers: tech, tags: { name: "list_technician_jobs" } },
  );
  check(jobs, { "technician jobs 2xx": (r) => r.status >= 200 && r.status < 300 });

  sleep(0.5);
}
