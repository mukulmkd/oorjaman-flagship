import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, VendorRow } from "@oorjaman/api";
import { vendorApi } from "@oorjaman/api";
import { Button, Card, TextArea } from "@oorjaman/web-ui";

type DashboardSettings = {
  blackout_dates: string[];
  default_technician_id: string | null;
};

function parseDashboardSettings(metadata: Json | undefined): DashboardSettings {
  const base: DashboardSettings = { blackout_dates: [], default_technician_id: null };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return base;
  const ds = (metadata as Record<string, unknown>).dashboard_settings;
  if (!ds || typeof ds !== "object" || Array.isArray(ds)) return base;
  const d = ds as Record<string, unknown>;
  if (Array.isArray(d.blackout_dates)) {
    base.blackout_dates = d.blackout_dates.filter((x): x is string => typeof x === "string");
  }
  if (typeof d.default_technician_id === "string") base.default_technician_id = d.default_technician_id;
  return base;
}

function mergeDashboardMetadata(existing: Json, settings: DashboardSettings): Json {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, Json>) }
      : {};
  return {
    ...base,
    dashboard_settings: {
      blackout_dates: settings.blackout_dates,
      default_technician_id: null,
    },
  } as Json;
}

type Props = {
  supabase: SupabaseClient<Database>;
  vendor: VendorRow | null | undefined;
  onSaved: () => void;
};

export function VendorSettingsTab({ supabase, vendor, onSaved }: Props) {
  const [blackoutText, setBlackoutText] = useState("");
  const [serviceAreasText, setServiceAreasText] = useState("");
  const [operatingRegionsText, setOperatingRegionsText] = useState("");
  const [serviceablePinsText, setServiceablePinsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const ds = parseDashboardSettings(vendor.metadata);
    setBlackoutText(ds.blackout_dates.join("\n"));
    setServiceAreasText((vendor.service_areas ?? []).join("\n"));
    setOperatingRegionsText((vendor.operating_regions ?? []).join("\n"));
    const meta =
      vendor.metadata && typeof vendor.metadata === "object" && !Array.isArray(vendor.metadata)
        ? (vendor.metadata as Record<string, unknown>)
        : {};
    const pins = Array.isArray(meta.serviceable_pincodes)
      ? (meta.serviceable_pincodes as unknown[])
          .map((x) => (typeof x === "string" ? x : ""))
          .filter(Boolean)
      : [];
    setServiceablePinsText(pins.join("\n"));
  }, [vendor]);

  const save = async () => {
    if (!vendor) return;
    setSaving(true);
    setError(null);
    try {
      const lines = blackoutText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const serviceAreas = [...new Set(
        serviceAreasText
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
      )];
      const operatingRegions = [...new Set(
        operatingRegionsText
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
      )];
      const serviceablePins = [...new Set(
        serviceablePinsText
          .split(/\r?\n|,/)
          .map((s) => s.replace(/\D/g, "").slice(0, 6))
          .filter((s) => s.length === 6),
      )];
      const metadata = mergeDashboardMetadata(vendor.metadata, {
        blackout_dates: lines,
        default_technician_id: null,
      });
      const mergedMeta =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? {
              ...(metadata as Record<string, Json>),
              serviceable_pincodes: serviceablePins as unknown as Json,
            }
          : metadata;
      await vendorApi.updateMyVendorProfile(supabase, {
        metadata: mergedMeta as Json,
        service_areas: serviceAreas,
        operating_regions: operatingRegions,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vd-stack">
      <Card padded>
        <h3 className="vd-subtitle">Coverage settings</h3>
        <p className="vd-note vd-note-tight">
          Manage serviceable coverage exactly like modern marketplaces: primary by PIN codes, then city/region tags.
        </p>
        <TextArea
          label="Serviceable PIN codes (one per line)"
          value={serviceablePinsText}
          onChange={(e) => setServiceablePinsText(e.target.value)}
          placeholder="560001&#10;560034&#10;560102"
        />
        {(serviceablePinsText
          .split(/\r?\n|,/)
          .map((s) => s.replace(/\D/g, "").slice(0, 6))
          .filter((s) => s.length === 6).length ?? 0) === 0 ? (
          <p className="vd-error vd-note-spaced">
            No serviceable PIN code configured. Your partner discoverability in Preferred Vendor may drop.
          </p>
        ) : null}
        <TextArea
          label="Service areas (city/locality tags)"
          value={serviceAreasText}
          onChange={(e) => setServiceAreasText(e.target.value)}
          placeholder="Bengaluru Urban&#10;Whitefield&#10;Electronic City"
          rows={4}
        />
        <TextArea
          label="Operating regions (state/zone tags)"
          value={operatingRegionsText}
          onChange={(e) => setOperatingRegionsText(e.target.value)}
          placeholder="Karnataka&#10;South Bengaluru zone"
          rows={3}
        />
      </Card>

      <Card padded>
        <h3 className="vd-subtitle">Scheduling preferences</h3>
        <TextArea
          label="Blackout dates (one ISO date per line, e.g. 2026-12-25)"
          value={blackoutText}
          onChange={(e) => setBlackoutText(e.target.value)}
          placeholder="2026-10-02&#10;2026-11-15"
        />
        <p className="vd-caption">
          Your organisation assigns its own verified technicians during booking acceptance.
        </p>
        {error ? (
          <p className="vd-error vd-note-spaced">{error}</p>
        ) : null}
        <div className="vd-top-gap">
          <Button type="button" loading={saving} disabled={!vendor} onClick={() => void save()}>
            Save preferences
          </Button>
        </div>
      </Card>
    </div>
  );
}
