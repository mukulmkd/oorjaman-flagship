import { webTypography } from "./../styles/typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminDeletePricingCityTier,
  adminDeletePricingRule,
  adminDeletePricingTier,
  adminListPricingNationalDefaultAudit,
  adminPatchPricingTierCapacityAddons,
  adminSavePricingCityTier,
  adminSavePricingRule,
  adminSavePricingTier,
  calculatePrice,
  DEFAULT_TABLE_PAGE_SIZE,
  formatInrFromCents,
  listPricingCityTiers,
  listPricingRules,
  listPricingTiers,
  normalizeCountryCode,
  queryKeys,
  type CalculatedPriceResult,
  type Database,
  type PricingNationalDefaultAuditRow,
  type PricingRuleRow,
  type PricingTierRow,
} from "@oorjaman/api";
import { Button, Card, Input, PageHeader, TableRowsSkeleton } from "@oorjaman/web-ui";
import { TablePaginationBar } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";

function paiseToRupeeInput(paise: number): string {
  const v = paise / 100;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function parseRupeeToPaise(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function snapshotSummary(j: unknown): string {
  if (!j || typeof j !== "object" || Array.isArray(j)) return "-";
  const o = j as Record<string, unknown>;
  const base = Number(o.base_price) || 0;
  const pp = Number(o.per_panel_rate) || 0;
  const pk = Number(o.per_kw_rate) || 0;
  const m = Number(o.multiplier) > 0 ? Number(o.multiplier) : 1;
  return `${formatInrFromCents(base)} base · ${formatInrFromCents(pp)}/panel · ${formatInrFromCents(pk)}/kW · ×${m}`;
}

function auditRowSummary(row: PricingNationalDefaultAuditRow): string {
  if (row.operation === "delete") return snapshotSummary(row.old_snapshot);
  if (row.operation === "insert") return snapshotSummary(row.new_snapshot);
  return `${snapshotSummary(row.old_snapshot)} → ${snapshotSummary(row.new_snapshot)}`;
}

function isNationalRule(r: PricingRuleRow): boolean {
  const noCity = r.city == null || r.city.trim() === "";
  const noTier = r.tier_code == null || String(r.tier_code).trim() === "";
  return noCity && noTier;
}

function isTierRuleRow(r: PricingRuleRow): boolean {
  return Boolean(r.tier_code?.trim()) && (r.city == null || r.city.trim() === "");
}

function isLegacyCityRuleRow(r: PricingRuleRow): boolean {
  return Boolean(r.city?.trim()) && (r.tier_code == null || r.tier_code.trim() === "");
}

export function PricingManagementPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [countryCode, setCountryCode] = useState("IN");
  const [cityTierMapPage, setCityTierMapPage] = useState(1);
  const [legacyRulesPage, setLegacyRulesPage] = useState(1);

  const rulesQuery = useQuery({
    queryKey: queryKeys.pricing.rules(),
    queryFn: () => listPricingRules(supabase!),
    enabled: Boolean(supabase),
  });
  const tiersQuery = useQuery({
    queryKey: queryKeys.pricing.tiers(normalizeCountryCode(countryCode)),
    queryFn: () => listPricingTiers(supabase!, normalizeCountryCode(countryCode)),
    enabled: Boolean(supabase),
  });
  const cityTiersQuery = useQuery({
    queryKey: queryKeys.pricing.cityTiers(normalizeCountryCode(countryCode)),
    queryFn: () => listPricingCityTiers(supabase!, normalizeCountryCode(countryCode)),
    enabled: Boolean(supabase),
  });

  const nationalAuditQuery = useQuery({
    queryKey: queryKeys.pricing.nationalDefaultAudit(normalizeCountryCode(countryCode)),
    queryFn: () => adminListPricingNationalDefaultAudit(supabase!, { countryCode, limit: 50 }),
    enabled: Boolean(supabase),
  });

  const invalidatePricing = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.rules() });
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.tiers(normalizeCountryCode(countryCode)) });
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.cityTiers(normalizeCountryCode(countryCode)) });
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.nationalDefaultAudit(normalizeCountryCode(countryCode)) });
  };

  const rulesScoped = useMemo(() => {
    const cc = normalizeCountryCode(countryCode);
    return (rulesQuery.data ?? []).filter((r) => normalizeCountryCode(r.country_code) === cc);
  }, [rulesQuery.data, countryCode]);

  const defaultRule = useMemo(() => rulesScoped.find(isNationalRule) ?? null, [rulesScoped]);
  const tierRules = useMemo(() => rulesScoped.filter(isTierRuleRow), [rulesScoped]);
  const cityRules = useMemo(
    () => [...rulesScoped.filter(isLegacyCityRuleRow)].sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "")),
    [rulesScoped],
  );

  useEffect(() => {
    setCityTierMapPage(1);
    setLegacyRulesPage(1);
  }, [countryCode]);

  const cityTierRowsAll = useMemo(() => cityTiersQuery.data ?? [], [cityTiersQuery.data]);
  const cityTierTotal = cityTierRowsAll.length;
  const cityTierWindow = useMemo(
    () =>
      cityTierRowsAll.slice(
        (cityTierMapPage - 1) * DEFAULT_TABLE_PAGE_SIZE,
        cityTierMapPage * DEFAULT_TABLE_PAGE_SIZE,
      ),
    [cityTierRowsAll, cityTierMapPage],
  );

  const legacyRulesTotal = cityRules.length;
  const legacyRulesWindow = useMemo(
    () =>
      cityRules.slice((legacyRulesPage - 1) * DEFAULT_TABLE_PAGE_SIZE, legacyRulesPage * DEFAULT_TABLE_PAGE_SIZE),
    [cityRules, legacyRulesPage],
  );

  const [defBase, setDefBase] = useState("");
  const [defPanel, setDefPanel] = useState("");
  const [defKw, setDefKw] = useState("");
  const [defMult, setDefMult] = useState("1");

  useEffect(() => {
    if (!defaultRule) return;
    setDefBase(paiseToRupeeInput(defaultRule.base_price));
    setDefPanel(paiseToRupeeInput(defaultRule.per_panel_rate));
    setDefKw(paiseToRupeeInput(defaultRule.per_kw_rate));
    setDefMult(String(defaultRule.multiplier));
  }, [defaultRule]);

  const saveDefaultMut = useMutation({
    mutationFn: async () => {
      if (!supabase || !defaultRule) throw new Error("Missing client or national default.");
      return adminSavePricingRule(supabase, {
        id: defaultRule.id,
        country_code: normalizeCountryCode(countryCode),
        city: null,
        tier_code: null,
        base_price: parseRupeeToPaise(defBase),
        per_panel_rate: parseRupeeToPaise(defPanel),
        per_kw_rate: parseRupeeToPaise(defKw),
        multiplier: Math.max(0.0001, Number.parseFloat(defMult) || 1),
      });
    },
    onSuccess: () => void invalidatePricing(),
  });

  const [newTierCode, setNewTierCode] = useState("");
  const [newTierLabel, setNewTierLabel] = useState("");
  const [newTierSort, setNewTierSort] = useState("100");

  const addTierMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No Supabase client");
      return adminSavePricingTier(supabase, {
        country_code: normalizeCountryCode(countryCode),
        code: newTierCode.trim(),
        label: newTierLabel.trim(),
        sort_order: Number.parseInt(newTierSort, 10) || 0,
      });
    },
    onSuccess: async () => {
      setNewTierCode("");
      setNewTierLabel("");
      setNewTierSort("100");
      await invalidatePricing();
    },
  });

  const deleteTierMut = useMutation({
    mutationFn: (id: string) => adminDeletePricingTier(supabase!, id),
    onSuccess: () => void invalidatePricing(),
  });

  const [mapCity, setMapCity] = useState("");
  const [mapStateKey, setMapStateKey] = useState("");
  const [mapTierCode, setMapTierCode] = useState("");

  const addCityTierMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No client");
      if (!mapTierCode.trim()) throw new Error("Pick a tier.");
      return adminSavePricingCityTier(supabase, {
        country_code: normalizeCountryCode(countryCode),
        city_name: mapCity.trim(),
        state_key: mapStateKey.trim() || null,
        tier_code: mapTierCode.trim(),
      });
    },
    onSuccess: async () => {
      setMapCity("");
      setMapStateKey("");
      setMapTierCode("");
      await invalidatePricing();
    },
  });

  const deleteCityTierMut = useMutation({
    mutationFn: (id: string) => adminDeletePricingCityTier(supabase!, id),
    onSuccess: () => void invalidatePricing(),
  });

  const [newCity, setNewCity] = useState("");
  const [newBase, setNewBase] = useState("0");
  const [newPanel, setNewPanel] = useState("0");
  const [newKw, setNewKw] = useState("0");
  const [newMult, setNewMult] = useState("1");

  const addCityMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No Supabase client");
      const c = newCity.trim();
      if (!c) throw new Error("Enter a city name.");
      return adminSavePricingRule(supabase, {
        country_code: normalizeCountryCode(countryCode),
        city: c,
        tier_code: null,
        base_price: parseRupeeToPaise(newBase),
        per_panel_rate: parseRupeeToPaise(newPanel),
        per_kw_rate: parseRupeeToPaise(newKw),
        multiplier: Math.max(0.0001, Number.parseFloat(newMult) || 1),
      });
    },
    onSuccess: async () => {
      await invalidatePricing();
      setNewCity("");
      setNewBase("0");
      setNewPanel("0");
      setNewKw("0");
      setNewMult("1");
    },
  });

  const [previewPanels, setPreviewPanels] = useState("24");
  const [previewKw, setPreviewKw] = useState("5");
  const [previewCity, setPreviewCity] = useState("");
  const [previewResult, setPreviewResult] = useState<CalculatedPriceResult | null>(null);

  const previewMut = useMutation({
    mutationFn: async () => {
      return calculatePrice(supabase!, {
        panel_count: Number.parseInt(previewPanels, 10) || 0,
        capacity_kw: Number.parseFloat(previewKw) || 0,
        location: {
          city: previewCity.trim() || null,
          country_code: normalizeCountryCode(countryCode),
        },
      });
    },
    onSuccess: (data) => setPreviewResult(data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeletePricingRule(supabase!, id),
    onSuccess: () => void invalidatePricing(),
  });

  return (
    <>
      <PageHeader
        title="Pricing engine"
        subtitle="Configure how visit estimates are calculated for customers (country-scoped, India-first)."
      />

      {!supabase ? (
        <Card padded>
          <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
            Connect Supabase via Vite env variables.
          </p>
        </Card>
      ) : rulesQuery.isLoading ? (
        <Card padded>
          <TableRowsSkeleton rows={6} />
        </Card>
      ) : rulesQuery.isError ? (
        <Card padded>
          <p style={{ margin: "0 0 0.5rem", fontWeight: webTypography.weight.semibold }}>Couldn&apos;t load pricing rules</p>
          <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
            {(rulesQuery.error as Error).message}
          </p>
        </Card>
      ) : (
        <>
          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>What each section does</h2>
            <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.65 }}>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--wb-fg)" }}>National default</strong> - fallback rate card when we cannot match the
                customer&apos;s city to a tier (or legacy city row). Every active country should have exactly one row with
                empty city and empty tier. Stored in INR <span className="vd-mono">paise</span> (integer; divide by 100 for rupees).
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--wb-fg)" }}>Tier catalog</strong> - named bands (e.g. metro vs town). Only labels + sort
                order; no money here.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--wb-fg)" }}>Tier rate cards</strong> - one money row per tier code (base + per panel +
                per kW + multiplier). Used when the customer&apos;s city appears in the city→tier map.
              </li>
              <li style={{ marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--wb-fg)" }}>City → tier map</strong> - maps a normalized city name to a tier code so
                the engine picks the right tier rate card.
              </li>
              <li>
                <strong style={{ color: "var(--wb-fg)" }}>Legacy city override</strong> - optional per-city money row that bypasses
                tiers if present. Prefer city→tier + tier cards for new markets.
              </li>
            </ol>
            <p style={{ margin: "0.75rem 0 0", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--wb-fg)" }}>Resolve order</strong> for a quote: city→tier map → tier rate card → legacy
              city row → national default. Customer apps send an ISO-style country code (we normalize e.g. IND / India → IN) so it
              lines up with rows here.
            </p>
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>Market</h2>
            <label className="bm-label" htmlFor="pricing-country">
              Country code
            </label>
            <select
              id="pricing-country"
              className="vd-select"
              style={{ maxWidth: 280, marginBottom: "0.5rem" }}
              value={countryCode}
              onChange={(e) => setCountryCode(normalizeCountryCode(e.target.value))}
            >
              <option value="IN">India (IN)</option>
            </select>
            <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Same model scales to other countries: add tiers, city maps, and rules keyed by ISO country code.
            </p>
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>National default</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Used when no tier card or legacy city row matches after city→tier lookup.
            </p>
            {defaultRule ? (
              <div style={{ display: "grid", gap: "0.75rem", maxWidth: "32rem" }}>
                <Input label="Base (₹)" value={defBase} onChange={(e: ChangeEvent<HTMLInputElement>) => setDefBase(e.target.value)} />
                <Input label="Per panel (₹)" value={defPanel} onChange={(e: ChangeEvent<HTMLInputElement>) => setDefPanel(e.target.value)} />
                <Input label="Per kW (₹)" value={defKw} onChange={(e: ChangeEvent<HTMLInputElement>) => setDefKw(e.target.value)} />
                <Input label="Multiplier" value={defMult} onChange={(e: ChangeEvent<HTMLInputElement>) => setDefMult(e.target.value)} />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={saveDefaultMut.isPending}
                  onClick={() => void saveDefaultMut.mutate()}
                >
                  Save national default
                </Button>
                {saveDefaultMut.isError ? (
                  <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
                    {(saveDefaultMut.error as Error).message}
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: webTypography.size.sm }}>Missing national row for {countryCode} - apply DB migration.</p>
            )}
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>National default - audit trail</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Each save to the national row is logged (who / when / before→after). Apply migration{" "}
              <code className="vd-mono">20260618160000_pricing_national_default_audit</code> if this list is empty after edits.
            </p>
            {nationalAuditQuery.isLoading ? (
              <p style={{ margin: 0, fontSize: webTypography.size.sm }}>Loading history…</p>
            ) : nationalAuditQuery.isError ? (
              <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
                {(nationalAuditQuery.error as Error).message}
              </p>
            ) : (nationalAuditQuery.data ?? []).length === 0 ? (
              <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                No audit rows yet for {normalizeCountryCode(countryCode)} - history starts after the migration is applied and you
                save the national default again.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: webTypography.size.sm, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--wb-border)" }}>When (local)</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--wb-border)" }}>Action</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--wb-border)" }}>Actor</th>
                      <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--wb-border)" }}>Rates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(nationalAuditQuery.data ?? []).map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: "0.5rem", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          {new Date(row.changed_at).toLocaleString()}
                        </td>
                        <td style={{ padding: "0.5rem", verticalAlign: "top" }}>{row.operation}</td>
                        <td style={{ padding: "0.5rem", verticalAlign: "top", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }} title={row.changed_by ?? ""}>
                          {row.changed_by ? `${row.changed_by.slice(0, 8)}…` : "-"}
                        </td>
                        <td style={{ padding: "0.5rem", verticalAlign: "top", lineHeight: 1.45 }}>{auditRowSummary(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>Tier catalog</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Internal labels for metro bands etc. Stable <code className="vd-mono">code</code> is used by rate cards.
            </p>
            {(tiersQuery.data ?? []).length === 0 ? (
              <p style={{ fontSize: webTypography.size.sm }}>Loading tiers…</p>
            ) : (
              <ul style={{ margin: "0 0 1rem", paddingLeft: "1.1rem", fontSize: webTypography.size.sm }}>
                {(tiersQuery.data ?? []).map((t) => (
                  <li key={t.id} style={{ marginBottom: "0.35rem" }}>
                    <strong className="vd-mono">{t.code}</strong> - {t.label}{" "}
                    <button
                      type="button"
                      style={{ marginLeft: 8, border: "none", background: "none", cursor: "pointer", color: "var(--wb-destructive)" }}
                      onClick={() => {
                        if (!window.confirm(`Delete tier "${t.code}"? Fails if still referenced.`)) return;
                        void deleteTierMut.mutateAsync(t.id);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: "grid", gap: "0.65rem", maxWidth: "32rem" }}>
              <Input label="New tier code" value={newTierCode} onChange={(e) => setNewTierCode(e.target.value)} placeholder="tier_5_region" />
              <Input label="Label" value={newTierLabel} onChange={(e) => setNewTierLabel(e.target.value)} placeholder="Readable name" />
              <Input label="Sort order" value={newTierSort} onChange={(e) => setNewTierSort(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={addTierMut.isPending}
                onClick={() => void addTierMut.mutate()}
                disabled={!newTierCode.trim() || !newTierLabel.trim()}
              >
                Add tier
              </Button>
              {addTierMut.isError ? (
                <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
                  {(addTierMut.error as Error).message}
                </p>
              ) : null}
            </div>
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>Tier rate cards</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              One row per tier. If missing, engine falls back through legacy city row → national default.
            </p>
            {(tiersQuery.data ?? []).map((tier) => {
              const row = tierRules.find((r) => r.tier_code?.trim() === tier.code) ?? null;
              return (
                <TierRateCard
                  key={tier.id}
                  tier={tier}
                  country={normalizeCountryCode(countryCode)}
                  existingRule={row}
                  client={supabase}
                  onSaved={() => void invalidatePricing()}
                />
              );
            })}
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>City → tier map</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Customer city labels are normalized (case-insensitive). One row per city per country.
            </p>
            <div style={{ display: "grid", gap: "0.65rem", maxWidth: "36rem", marginBottom: "1rem" }}>
              <Input label="City name" value={mapCity} onChange={(e) => setMapCity(e.target.value)} placeholder="mumbai" />
              <Input label="State hint (optional)" value={mapStateKey} onChange={(e) => setMapStateKey(e.target.value)} />
              <label className="bm-label" htmlFor="tier-pick-map">
                Tier
              </label>
              <select id="tier-pick-map" className="vd-select" value={mapTierCode} onChange={(e) => setMapTierCode(e.target.value)}>
                <option value="">Choose tier…</option>
                {(tiersQuery.data ?? []).map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
              <Button type="button" variant="primary" size="sm" loading={addCityTierMut.isPending} onClick={() => void addCityTierMut.mutate()}>
                Upsert mapping
              </Button>
              {addCityTierMut.isError ? (
                <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
                  {(addCityTierMut.error as Error).message}
                </p>
              ) : null}
            </div>
            {cityTiersQuery.isLoading ? (
              <p style={{ fontSize: webTypography.size.sm }}>Loading city map…</p>
            ) : cityTierTotal === 0 ? (
              <p style={{ fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>No mappings - national default applies.</p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>City key</th>
                        <th>Tier</th>
                        <th>State</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {cityTierWindow.map((row) => (
                        <tr key={row.id}>
                          <td className="vd-mono">{row.city_key}</td>
                          <td className="vd-mono">{row.tier_code}</td>
                          <td>{row.state_key ?? "-"}</td>
                          <td>
                            <button
                              type="button"
                              className="bm-error"
                              style={{ border: "none", background: "none", cursor: "pointer", textDecoration: "underline" }}
                              onClick={() => {
                                void deleteCityTierMut.mutateAsync(row.id);
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <TablePaginationBar page={cityTierMapPage} total={cityTierTotal} onPageChange={setCityTierMapPage} />
                </div>
              </>
            )}
          </Card>

          <Card padded style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>Legacy city override</h2>
            <p style={{ margin: "0 0 1rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)", lineHeight: 1.5 }}>
              Optional escape hatch - matches exact city row if tier lookup did not apply. Prefer city→tier for new work.
            </p>
            <div style={{ display: "grid", gap: "0.75rem", maxWidth: "32rem" }}>
              <Input label="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
              <Input label="Base (₹)" value={newBase} onChange={(e) => setNewBase(e.target.value)} />
              <Input label="Per panel (₹)" value={newPanel} onChange={(e) => setNewPanel(e.target.value)} />
              <Input label="Per kW (₹)" value={newKw} onChange={(e) => setNewKw(e.target.value)} />
              <Input label="Multiplier" value={newMult} onChange={(e) => setNewMult(e.target.value)} />
              <Button type="button" variant="outline" size="sm" loading={addCityMut.isPending} onClick={() => void addCityMut.mutate()}>
                Add legacy rule
              </Button>
              {addCityMut.isError ? (
                <p style={{ margin: 0, color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
                  {(addCityMut.error as Error).message}
                </p>
              ) : null}
            </div>
          </Card>

          <Card padded={false} style={{ marginBottom: "1.25rem" }}>
            <div style={{ padding: "1rem 1rem 0" }}>
              <h2 style={{ margin: 0, fontSize: webTypography.size.md }}>Legacy city rules</h2>
            </div>
            {legacyRulesTotal === 0 ? (
              <p style={{ padding: "1rem", margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
                No legacy overrides.
              </p>
            ) : (
              <>
                <div className="bm-table-wrap">
                  <table className="bm-table">
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>Base (₹)</th>
                        <th>Panel (₹)</th>
                        <th>kW (₹)</th>
                        <th>Mult</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyRulesWindow.map((r) => (
                        <LegacyCityRuleRow key={r.id} rule={r} client={supabase!} onSaved={() => void invalidatePricing()} onDelete={() => deleteMut.mutate(r.id)} deleting={deleteMut.isPending} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "0.75rem 1rem 1rem" }}>
                  <TablePaginationBar page={legacyRulesPage} total={legacyRulesTotal} onPageChange={setLegacyRulesPage} />
                </div>
              </>
            )}
          </Card>

          <Card padded>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.md }}>Preview</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", marginBottom: "0.75rem" }}>
              <Input label="Panels" value={previewPanels} onChange={(e) => setPreviewPanels(e.target.value)} />
              <Input label="Capacity (kW)" value={previewKw} onChange={(e) => setPreviewKw(e.target.value)} />
              <Input label="City (optional)" value={previewCity} onChange={(e) => setPreviewCity(e.target.value)} />
              <Button type="button" variant="primary" size="sm" loading={previewMut.isPending} onClick={() => void previewMut.mutate()}>
                Run preview
              </Button>
            </div>
            {previewMut.isError ? (
              <p style={{ color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>{(previewMut.error as Error).message}</p>
            ) : null}
            {previewResult ? (
              <p style={{ margin: 0, fontSize: webTypography.size.md }}>
                <strong>Subtotal:</strong> {formatInrFromCents(previewResult.subtotal_paise)} ·{" "}
                <strong>Final:</strong> {formatInrFromCents(previewResult.final_paise)} ·{" "}
                <span style={{ color: "var(--wb-muted-fg)" }}>
                  {previewResult.matched_tier_label
                    ? `${previewResult.matched_tier_label} (${previewResult.pricing_country_code})`
                    : previewResult.matched_city
                      ? `City legacy: ${previewResult.matched_city}`
                      : `National default (${previewResult.pricing_country_code})`}
                </span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>Run preview to see routing.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function TierRateCard({
  tier,
  country,
  existingRule,
  client,
  onSaved,
}: {
  tier: PricingTierRow;
  country: string;
  existingRule: PricingRuleRow | null;
  client: SupabaseClient<Database>;
  onSaved: () => void;
}) {
  const [base, setBase] = useState(paiseToRupeeInput(existingRule?.base_price ?? 0));
  const [panel, setPanel] = useState(paiseToRupeeInput(existingRule?.per_panel_rate ?? 0));
  const [kw, setKw] = useState(paiseToRupeeInput(existingRule?.per_kw_rate ?? 0));
  const [mult, setMult] = useState(String(existingRule?.multiplier ?? 1));
  const [visitAddonIn, setVisitAddonIn] = useState(() => paiseToRupeeInput(Number(tier.visit_addon_cents) || 0));
  const [amcAddonIn, setAmcAddonIn] = useState(() => paiseToRupeeInput(Number(tier.amc_addon_cents) || 0));

  useEffect(() => {
    setBase(paiseToRupeeInput(existingRule?.base_price ?? 0));
    setPanel(paiseToRupeeInput(existingRule?.per_panel_rate ?? 0));
    setKw(paiseToRupeeInput(existingRule?.per_kw_rate ?? 0));
    setMult(String(existingRule?.multiplier ?? 1));
  }, [existingRule]);

  useEffect(() => {
    setVisitAddonIn(paiseToRupeeInput(Number(tier.visit_addon_cents) || 0));
    setAmcAddonIn(paiseToRupeeInput(Number(tier.amc_addon_cents) || 0));
  }, [tier.id, tier.visit_addon_cents, tier.amc_addon_cents]);

  const saveAddonsMut = useMutation({
    mutationFn: async () =>
      adminPatchPricingTierCapacityAddons(client, {
        id: tier.id,
        visit_addon_cents: parseRupeeToPaise(visitAddonIn),
        amc_addon_cents: parseRupeeToPaise(amcAddonIn),
      }),
    onSuccess: () => onSaved(),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      return adminSavePricingRule(client, {
        id: existingRule?.id,
        country_code: country,
        tier_code: tier.code,
        city: null,
        base_price: parseRupeeToPaise(base),
        per_panel_rate: parseRupeeToPaise(panel),
        per_kw_rate: parseRupeeToPaise(kw),
        multiplier: Math.max(0.0001, Number.parseFloat(mult) || 1),
      });
    },
    onSuccess: () => onSaved(),
  });

  return (
    <Card padded style={{ marginBottom: "1rem" }}>
      <div className="dash-card-row-head">
        <p className="dash-card-title">{tier.label}</p>
        <p className="dash-card-sub vd-mono">{tier.code}</p>
      </div>
      <div className="dash-card-grid">
        <Input label="Base (₹)" value={base} onChange={(e) => setBase(e.target.value)} />
        <Input label="Per panel (₹)" value={panel} onChange={(e) => setPanel(e.target.value)} />
        <Input label="Per kW (₹)" value={kw} onChange={(e) => setKw(e.target.value)} />
        <Input label="Multiplier" value={mult} onChange={(e) => setMult(e.target.value)} />
      </div>
      <div className="dash-card-actions">
        <Button type="button" variant="primary" size="sm" loading={saveMut.isPending} onClick={() => void saveMut.mutate()}>
          Save tier rates
        </Button>
      </div>
      {saveMut.isError ? (
        <p style={{ margin: "0.5rem 0 0", color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
          {(saveMut.error as Error).message}
        </p>
      ) : null}
      <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px solid var(--wb-border, #e7e5e4)" }} />
      <p style={{ margin: "0 0 0.5rem", fontSize: webTypography.size.sm, color: "var(--wb-muted-fg)" }}>
        Fixed catalogue surcharge when a customer&apos;s city maps to this geo tier - stacked on Service pricing (visit +
        AMC).
      </p>
      <div className="dash-card-grid">
        <Input
          label="Visit add-on (₹)"
          value={visitAddonIn}
          onChange={(e) => setVisitAddonIn(e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="AMC plan add-on (₹)"
          value={amcAddonIn}
          onChange={(e) => setAmcAddonIn(e.target.value)}
          inputMode="decimal"
        />
      </div>
      <div className="dash-card-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={saveAddonsMut.isPending}
          onClick={() => void saveAddonsMut.mutate()}
        >
          Save tier add-ons
        </Button>
      </div>
      {saveAddonsMut.isError ? (
        <p style={{ margin: "0.5rem 0 0", color: "var(--wb-destructive)", fontSize: webTypography.size.sm }}>
          {(saveAddonsMut.error as Error).message}
        </p>
      ) : null}
    </Card>
  );
}

function LegacyCityRuleRow({
  rule,
  client,
  onSaved,
  onDelete,
  deleting,
}: {
  rule: PricingRuleRow;
  client: SupabaseClient<Database>;
  onSaved: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [base, setBase] = useState(paiseToRupeeInput(rule.base_price));
  const [panel, setPanel] = useState(paiseToRupeeInput(rule.per_panel_rate));
  const [kw, setKw] = useState(paiseToRupeeInput(rule.per_kw_rate));
  const [mult, setMult] = useState(String(rule.multiplier));

  useEffect(() => {
    setBase(paiseToRupeeInput(rule.base_price));
    setPanel(paiseToRupeeInput(rule.per_panel_rate));
    setKw(paiseToRupeeInput(rule.per_kw_rate));
    setMult(String(rule.multiplier));
  }, [rule]);

  const saveMut = useMutation({
    mutationFn: async () => {
      return adminSavePricingRule(client, {
        id: rule.id,
        country_code: normalizeCountryCode(rule.country_code),
        city: rule.city,
        tier_code: null,
        base_price: parseRupeeToPaise(base),
        per_panel_rate: parseRupeeToPaise(panel),
        per_kw_rate: parseRupeeToPaise(kw),
        multiplier: Math.max(0.0001, Number.parseFloat(mult) || 1),
      });
    },
    onSuccess: () => onSaved(),
  });

  return (
    <tr>
      <td>
        <strong>{rule.city}</strong>
      </td>
      <td>
        <Input label="Base (₹)" value={base} onChange={(e) => setBase(e.target.value)} />
      </td>
      <td>
        <Input label="Per panel (₹)" value={panel} onChange={(e) => setPanel(e.target.value)} />
      </td>
      <td>
        <Input label="Per kW (₹)" value={kw} onChange={(e) => setKw(e.target.value)} />
      </td>
      <td>
        <Input label="Mult" value={mult} onChange={(e) => setMult(e.target.value)} />
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <Button type="button" variant="outline" size="sm" loading={saveMut.isPending} onClick={() => void saveMut.mutate()}>
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => void onDelete()}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
