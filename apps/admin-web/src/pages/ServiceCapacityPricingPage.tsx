import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  adminGetPlatformSettings,
  adminListPricingCatalogAudit,
  adminPatchPricingTierCapacityAddons,
  adminSavePricingAmcPlan,
  adminSavePricingOneTimeRate,
  adminUpdatePlatformSettings,
  listPricingAmcPlans,
  listPricingOneTimeRates,
  listPricingTiers,
  listServiceCapacityTiers,
  queryKeys,
  type PricingAmcPlanRow,
  type PricingCatalogAuditRow,
  type PricingOneTimeRateRow,
  type PricingTierRow,
  type ServiceCapacityTierRow,
} from "@oorjaman/api";
import { Button, Card, Input, PageHeader, TableRowsSkeleton } from "@oorjaman/web-ui";
import { CatalogueAuditHistoryButton } from "../components/CatalogueAuditHistory";
import { filterCatalogAuditForScope } from "../lib/pricing-catalog-audit";
import { useSupabase } from "../lib/supabase-context";
import "./service-capacity-pricing-page.css";

function paiseToRupeeInput(paise: number): string {
  const v = paise / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function parseRupeeToPaise(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function ServiceCapacityPricingPage() {
  const supabase = useSupabase();
  const qc = useQueryClient();
  const countryCode = "IN";

  const tiersQ = useQuery({
    queryKey: [...queryKeys.pricing.capacityCatalog(countryCode), "tiers"],
    queryFn: () => listServiceCapacityTiers(supabase!, countryCode),
    enabled: Boolean(supabase),
  });
  const oneTimeQ = useQuery({
    queryKey: [...queryKeys.pricing.capacityCatalog(countryCode), "one-time"],
    queryFn: () => listPricingOneTimeRates(supabase!, countryCode),
    enabled: Boolean(supabase),
  });
  const amcQ = useQuery({
    queryKey: queryKeys.pricing.capacityCatalog(countryCode),
    queryFn: () => listPricingAmcPlans(supabase!, countryCode),
    enabled: Boolean(supabase),
  });
  const auditQ = useQuery({
    queryKey: queryKeys.pricing.catalogAudit(countryCode),
    queryFn: () => adminListPricingCatalogAudit(supabase!, { countryCode, limit: 200 }),
    enabled: Boolean(supabase),
  });

  const catalogAuditRows = auditQ.data ?? [];
  const lateCancelAuditRows = useMemo(
    () => filterCatalogAuditForScope(catalogAuditRows, { kind: "platform_settings" }),
    [catalogAuditRows],
  );
  const geoTiersQ = useQuery({
    queryKey: queryKeys.pricing.tiers(countryCode),
    queryFn: () => listPricingTiers(supabase!, countryCode),
    enabled: Boolean(supabase),
  });
  const platformSettingsQ = useQuery({
    queryKey: queryKeys.platform.settings(),
    queryFn: () => adminGetPlatformSettings(supabase!),
    enabled: Boolean(supabase),
  });

  const [lateCancelFeeRupeeText, setLateCancelFeeRupeeText] = useState("");

  useEffect(() => {
    if (!platformSettingsQ.isSuccess || !platformSettingsQ.data) return;
    const paise = Math.max(0, Math.round(Number(platformSettingsQ.data.customer_late_cancel_fee_paise) || 0));
    setLateCancelFeeRupeeText(paiseToRupeeInput(paise));
  }, [platformSettingsQ.isSuccess, platformSettingsQ.data?.customer_late_cancel_fee_paise]);

  const saveLateCancelFeeMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("No Supabase client");
      const trimmed = lateCancelFeeRupeeText.replace(/,/g, "").trim();
      const n = Number.parseFloat(trimmed);
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid rupee amount.");
      const paise = Math.round(n * 100);
      return adminUpdatePlatformSettings(supabase, { customer_late_cancel_fee_paise: paise });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.platform.settings() });
      await qc.invalidateQueries({ queryKey: queryKeys.pricing.catalogAudit(countryCode) });
    },
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.capacityCatalog(countryCode) });
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.catalogAudit(countryCode) });
    await qc.invalidateQueries({ queryKey: queryKeys.pricing.tiers(countryCode) });
  };

  const saveOneTimeMut = useMutation({
    mutationFn: (input: Parameters<typeof adminSavePricingOneTimeRate>[1]) =>
      adminSavePricingOneTimeRate(supabase!, input),
    onSuccess: invalidate,
  });

  const saveAmcMut = useMutation({
    mutationFn: (input: Parameters<typeof adminSavePricingAmcPlan>[1]) => adminSavePricingAmcPlan(supabase!, input),
    onSuccess: invalidate,
  });

  const saveTierAddonMut = useMutation({
    mutationFn: (input: Parameters<typeof adminPatchPricingTierCapacityAddons>[1]) =>
      adminPatchPricingTierCapacityAddons(supabase!, input),
    onSuccess: invalidate,
  });

  const tiers = tiersQ.data ?? [];
  const oneTimeByTier = useMemo(() => {
    const m = new Map<string, PricingOneTimeRateRow>();
    for (const r of oneTimeQ.data ?? []) m.set(r.capacity_tier_code, r);
    return m;
  }, [oneTimeQ.data]);

  const amcByTier = useMemo(() => {
    const m = new Map<string, PricingAmcPlanRow[]>();
    for (const p of amcQ.data ?? []) {
      const list = m.get(p.capacity_tier_code) ?? [];
      list.push(p);
      m.set(p.capacity_tier_code, list);
    }
    for (const [, list] of m) list.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [amcQ.data]);

  const pending = tiersQ.isPending || oneTimeQ.isPending || amcQ.isPending || geoTiersQ.isPending;

  return (
    <div className="dash-page scp-page">
      <PageHeader
        title="Service capacity pricing"
        subtitle="One-time visits and AMC by kW band, customer late-cancellation fee, and geo-tier catalogue surcharges."
      />

      {!supabase ? (
        <Card padded>
          <p className="dash-help">Connect Supabase in admin settings to edit pricing.</p>
        </Card>
      ) : pending ? (
        <TableRowsSkeleton rows={8} />
      ) : (
        <>
          <p className="scp-intro">
            Each kW band is a discrete package (no 7 kW / 9 kW). Pricing below is stacked with city→tier surcharges -
            configured per geo tier in the grid at the bottom (also editable under Pricing management).
          </p>

          <Card padded>
            <div className="scp-section-head" style={{ marginBottom: "0.65rem" }}>
              <h2 className="scp-section-title" style={{ margin: 0 }}>
                Customer late cancellation
              </h2>
            </div>
            <p className="dash-help" style={{ marginTop: 0 }}>
              Fee reference after the 1-hour grace window from booking. Shown in the customer app before &quot;Cancel
              anyway&quot;; stored on bookings for vendors and ops.
            </p>
            {platformSettingsQ.isPending ? (
              <TableRowsSkeleton rows={2} />
            ) : (
              <div className="bm-table-wrap" style={{ marginTop: "0.85rem" }}>
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Setting</th>
                      <th>Amount</th>
                      <th className="scp-col-history" aria-label="History" />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    <LateCancelFeeRow
                      feeRupeeText={lateCancelFeeRupeeText}
                      onFeeChange={setLateCancelFeeRupeeText}
                      auditRows={lateCancelAuditRows}
                      saving={saveLateCancelFeeMut.isPending}
                      onSave={() => void saveLateCancelFeeMut.mutate()}
                    />
                  </tbody>
                </table>
              </div>
            )}
            {saveLateCancelFeeMut.isError ? (
              <p style={{ marginTop: "0.65rem", color: "var(--wb-destructive, #b91c1c)", fontSize: "0.875rem" }}>
                {(saveLateCancelFeeMut.error as Error).message}
              </p>
            ) : null}
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1.1rem 1.25rem 0.5rem" }}>
              <div className="scp-section-head">
                <h2 className="scp-section-title">One-time visit</h2>
                <span className="dash-help" style={{ margin: 0 }}>
                  Reference ₹100/panel benchmark - package price drives checkout.
                </span>
              </div>
            </div>
            <div className="bm-table-wrap" style={{ padding: "0 1.25rem 1.25rem" }}>
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Band</th>
                    <th>Tier code</th>
                    <th>Typical system</th>
                    <th>Visit (₹)</th>
                    <th>Per panel ref (₹)</th>
                    <th className="scp-col-history" aria-label="History" />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => (
                    <OneTimeVisitRow
                      key={t.code}
                      tier={t}
                      rate={oneTimeByTier.get(t.code)}
                      auditRows={filterCatalogAuditForScope(catalogAuditRows, {
                        kind: "one_time",
                        capacityTierCode: t.code,
                        recordId: oneTimeByTier.get(t.code)?.id,
                      })}
                      saving={saveOneTimeMut.isPending}
                      onSave={(amountPaise, perPanelPaise) =>
                        saveOneTimeMut.mutate({
                          id: oneTimeByTier.get(t.code)?.id,
                          capacity_tier_code: t.code,
                          amount_cents: amountPaise,
                          per_panel_rate_cents: perPanelPaise,
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1.1rem 1.25rem 0.5rem" }}>
              <h2 className="scp-section-title">AMC plans</h2>
              <p className="dash-help" style={{ margin: "0.35rem 0 0" }}>
                Annual maintenance contracts by kW band. Edit display name and price per plan code.
              </p>
            </div>
            <div className="bm-table-wrap" style={{ padding: "0 1.25rem 1.25rem" }}>
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>System band</th>
                    <th>Tier code</th>
                    <th>Plan code</th>
                    <th>Plan name</th>
                    <th>Coverage</th>
                    <th>Price (₹)</th>
                    <th className="scp-col-history" aria-label="History" />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tiers.flatMap((t) =>
                    (amcByTier.get(t.code) ?? []).map((p) => (
                      <AmcPlanTableRow
                        key={p.id}
                        tier={t}
                        plan={p}
                        auditRows={filterCatalogAuditForScope(catalogAuditRows, {
                          kind: "amc",
                          planCode: p.plan_code,
                          recordId: p.id,
                        })}
                        saving={saveAmcMut.isPending}
                        onSave={(patch) =>
                          saveAmcMut.mutate({
                            id: p.id,
                            capacity_tier_code: p.capacity_tier_code,
                            plan_code: p.plan_code,
                            plan_name: patch.plan_name,
                            contract_months: p.contract_months as 12 | 24,
                            visits_included: p.visits_included,
                            visits_per_year: p.visits_per_year,
                            amount_cents: patch.amount_cents,
                            sort_order: p.sort_order,
                          })
                        }
                      />
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padded={false}>
            <div style={{ padding: "1.1rem 1.25rem 0.5rem" }}>
              <div className="scp-section-head">
                <h2 className="scp-section-title">City-tier catalogue add-ons</h2>
                <span className="dash-help" style={{ margin: 0 }}>
                  Extra ₹ on visits and AMC when the customer&apos;s city maps to this geo tier (managed with city→tier
                  under Pricing management).
                </span>
              </div>
            </div>
            <div className="bm-table-wrap" style={{ padding: "0 1.25rem 1.25rem" }}>
              {(geoTiersQ.data ?? []).length === 0 ? (
                <p className="dash-help">No geo tiers yet - define them under Pricing management.</p>
              ) : (
                <table className="bm-table">
                  <thead>
                    <tr>
                      <th>Geo tier</th>
                      <th>Code</th>
                      <th>Visit add-on (₹)</th>
                      <th>AMC add-on (₹)</th>
                      <th className="scp-col-history" aria-label="History" />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(geoTiersQ.data ?? []).map((pt) => (
                      <TierAddonTableRow
                        key={pt.id}
                        tier={pt}
                        auditRows={filterCatalogAuditForScope(catalogAuditRows, {
                          kind: "geo_tier",
                          tierCode: pt.code,
                          recordId: pt.id,
                        })}
                        saving={saveTierAddonMut.isPending}
                        onSave={(v, a) => saveTierAddonMut.mutate({ id: pt.id, visit_addon_cents: v, amc_addon_cents: a })}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function LateCancelFeeRow({
  feeRupeeText,
  onFeeChange,
  auditRows,
  saving,
  onSave,
}: {
  feeRupeeText: string;
  onFeeChange: (value: string) => void;
  auditRows: PricingCatalogAuditRow[];
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <tr>
      <td>Late-cancellation fee (after grace window)</td>
      <td>
        <Input
          label=""
          value={feeRupeeText}
          onChange={(e) => onFeeChange(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
        />
      </td>
      <td className="scp-col-history">
        <CatalogueAuditHistoryButton rows={auditRows} />
      </td>
      <td>
        <Button size="sm" variant="outline" type="button" loading={saving} onClick={onSave}>
          Save
        </Button>
      </td>
    </tr>
  );
}

function OneTimeVisitRow({
  tier,
  rate,
  auditRows,
  saving,
  onSave,
}: {
  tier: ServiceCapacityTierRow;
  rate?: PricingOneTimeRateRow;
  auditRows: PricingCatalogAuditRow[];
  saving: boolean;
  onSave: (amount: number, perPanel: number) => void;
}) {
  const [visit, setVisit] = useState(() => paiseToRupeeInput(rate?.amount_cents ?? 0));
  const [perPanel, setPerPanel] = useState(() => paiseToRupeeInput(rate?.per_panel_rate_cents ?? 10000));

  useEffect(() => {
    setVisit(paiseToRupeeInput(rate?.amount_cents ?? 0));
    setPerPanel(paiseToRupeeInput(rate?.per_panel_rate_cents ?? 10000));
  }, [rate?.id, rate?.amount_cents, rate?.per_panel_rate_cents]);

  return (
    <tr>
      <td>
        <strong>{tier.label}</strong>
      </td>
      <td className="bm-cell-mono">{tier.code}</td>
      <td style={{ whiteSpace: "nowrap", fontSize: "0.875rem", color: "var(--wb-muted-fg, #78716c)" }}>
        ~{tier.typical_panel_count} panels · {tier.capacity_kw} kW
      </td>
      <td>
        <Input label="" value={visit} onChange={(e) => setVisit(e.target.value)} inputMode="decimal" />
      </td>
      <td>
        <Input label="" value={perPanel} onChange={(e) => setPerPanel(e.target.value)} inputMode="decimal" />
      </td>
      <td className="scp-col-history">
        <CatalogueAuditHistoryButton rows={auditRows} />
      </td>
      <td>
        <Button
          size="sm"
          variant="primary"
          type="button"
          loading={saving}
          onClick={() => onSave(parseRupeeToPaise(visit), parseRupeeToPaise(perPanel))}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

function TierAddonTableRow({
  tier,
  auditRows,
  saving,
  onSave,
}: {
  tier: PricingTierRow;
  auditRows: PricingCatalogAuditRow[];
  saving: boolean;
  onSave: (visitAddon: number, amcAddon: number) => void;
}) {
  const [visit, setVisit] = useState(() => paiseToRupeeInput(Number(tier.visit_addon_cents) || 0));
  const [amc, setAmc] = useState(() => paiseToRupeeInput(Number(tier.amc_addon_cents) || 0));

  useEffect(() => {
    setVisit(paiseToRupeeInput(Number(tier.visit_addon_cents) || 0));
    setAmc(paiseToRupeeInput(Number(tier.amc_addon_cents) || 0));
  }, [tier.id, tier.visit_addon_cents, tier.amc_addon_cents]);

  return (
    <tr>
      <td>
        <strong>{tier.label}</strong>
      </td>
      <td className="bm-cell-mono">{tier.code}</td>
      <td>
        <Input label="" value={visit} onChange={(e) => setVisit(e.target.value)} inputMode="decimal" />
      </td>
      <td>
        <Input label="" value={amc} onChange={(e) => setAmc(e.target.value)} inputMode="decimal" />
      </td>
      <td className="scp-col-history">
        <CatalogueAuditHistoryButton rows={auditRows} />
      </td>
      <td>
        <Button
          size="sm"
          variant="outline"
          type="button"
          loading={saving}
          onClick={() => onSave(parseRupeeToPaise(visit), parseRupeeToPaise(amc))}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

function AmcPlanTableRow({
  tier,
  plan,
  auditRows,
  saving,
  onSave,
}: {
  tier: ServiceCapacityTierRow;
  plan: PricingAmcPlanRow;
  auditRows: PricingCatalogAuditRow[];
  saving: boolean;
  onSave: (patch: { plan_name: string; amount_cents: number }) => void;
}) {
  const [name, setName] = useState(plan.plan_name);
  const [amount, setAmount] = useState(() => paiseToRupeeInput(plan.amount_cents));

  useEffect(() => {
    setName(plan.plan_name);
    setAmount(paiseToRupeeInput(plan.amount_cents));
  }, [plan.id, plan.plan_name, plan.amount_cents]);

  const coverage =
    plan.contract_months === 24
      ? `${plan.visits_included} visits / 2 years`
      : `${plan.visits_per_year ?? plan.visits_included}× per year · ${plan.visits_included} visits`;

  return (
    <tr>
      <td>
        <strong>{tier.label}</strong>
        <div className="bm-muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
          ~{tier.typical_panel_count} panels · {tier.capacity_kw} kW
        </div>
      </td>
      <td className="bm-cell-mono">{tier.code}</td>
      <td className="bm-cell-mono">{plan.plan_code}</td>
      <td>
        <Input label="" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td style={{ fontSize: "0.85rem", maxWidth: 200 }}>{coverage}</td>
      <td style={{ minWidth: 120 }}>
        <Input label="" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </td>
      <td className="scp-col-history">
        <CatalogueAuditHistoryButton rows={auditRows} />
      </td>
      <td>
        <Button
          size="sm"
          variant="outline"
          type="button"
          loading={saving}
          onClick={() => onSave({ plan_name: name.trim(), amount_cents: parseRupeeToPaise(amount) })}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}
