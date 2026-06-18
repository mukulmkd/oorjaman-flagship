import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coverageZonePinsFromText,
  coverageZonePinsToText,
  createEmptyCoverageZone,
  flattenCoverageZones,
  mergeCoverageIntoVendorMetadata,
  parseVendorCoverageZones,
  validateVendorCoverageZones,
  vendorApi,
  type Database,
  type Json,
  type VendorRow,
  type VendorServiceCoverageZone,
} from "@oorjaman/api";
import { Button, Card, TextArea } from "@oorjaman/web-ui";
import { TablePaginationBar } from "@oorjaman/web-ui";
import {
  countryByCode,
  listCitiesForState,
  listCountries,
  listStatesForCountry,
  resolveStateCode,
} from "../../lib/india-locations";

const COVERAGE_PAGE_SIZE = 10;

type DashboardSettings = {
  blackout_dates: string[];
};

function parseDashboardSettings(metadata: Json | undefined): DashboardSettings {
  const base: DashboardSettings = { blackout_dates: [] };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return base;
  const ds = (metadata as Record<string, unknown>).dashboard_settings;
  if (!ds || typeof ds !== "object" || Array.isArray(ds)) return base;
  const d = ds as Record<string, unknown>;
  if (Array.isArray(d.blackout_dates)) {
    base.blackout_dates = d.blackout_dates.filter((x): x is string => typeof x === "string");
  }
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

type ZoneEditorState = VendorServiceCoverageZone & { pinsText: string };

function zoneToEditor(z: VendorServiceCoverageZone): ZoneEditorState {
  const state_code = resolveStateCode(z.country_code, z.state_name, z.state_code);
  return {
    ...z,
    state_code,
    pinsText: coverageZonePinsToText(z.pincodes),
  };
}

function editorToZone(e: ZoneEditorState): VendorServiceCoverageZone {
  return {
    id: e.id,
    country_code: e.country_code,
    country_name: e.country_name,
    state_code: e.state_code,
    state_name: e.state_name,
    city_name: e.city_name,
    pincodes: coverageZonePinsFromText(e.pinsText),
  };
}

type Props = {
  supabase: SupabaseClient<Database>;
  vendor: VendorRow | null | undefined;
  onSaved: () => void;
};

export function VendorCoverageTab({ supabase, vendor, onSaved }: Props) {
  const [zones, setZones] = useState<ZoneEditorState[]>([]);
  const [blackoutText, setBlackoutText] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countries = useMemo(() => listCountries(), []);

  useEffect(() => {
    if (!vendor) return;
    const parsed = parseVendorCoverageZones(vendor);
    setZones(parsed.length > 0 ? parsed.map(zoneToEditor) : [zoneToEditor(createEmptyCoverageZone())]);
    const ds = parseDashboardSettings(vendor.metadata);
    setBlackoutText(ds.blackout_dates.join("\n"));
    setPage(1);
  }, [vendor]);

  const totalPages = Math.max(1, Math.ceil(zones.length / COVERAGE_PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageZones = useMemo(
    () => zones.slice((page - 1) * COVERAGE_PAGE_SIZE, page * COVERAGE_PAGE_SIZE),
    [zones, page],
  );

  const updateZone = useCallback((id: string, patch: Partial<ZoneEditorState>) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }, []);

  const addZone = () => {
    setZones((prev) => {
      const next = [...prev, zoneToEditor(createEmptyCoverageZone())];
      setPage(Math.max(1, Math.ceil(next.length / COVERAGE_PAGE_SIZE)));
      return next;
    });
  };

  const removeZone = (id: string) => {
    setZones((prev) => (prev.length <= 1 ? prev : prev.filter((z) => z.id !== id)));
  };

  const save = async () => {
    if (!vendor) return;
    const payloadZones = zones.map(editorToZone);
    const validationError = validateVendorCoverageZones(payloadZones);
    if (validationError) {
      setError(validationError);
      return;
    }
    const flat = flattenCoverageZones(payloadZones);

    setSaving(true);
    setError(null);
    try {
      const blackout_dates = blackoutText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      let metadata = mergeDashboardMetadata(vendor.metadata, { blackout_dates });
      metadata = mergeCoverageIntoVendorMetadata(metadata, payloadZones);
      await vendorApi.updateMyVendorProfile(supabase, {
        metadata,
        service_areas: flat.service_areas,
        operating_regions: flat.operating_regions,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save coverage");
    } finally {
      setSaving(false);
    }
  };

  const totalPins = zones.reduce((n, z) => n + coverageZonePinsFromText(z.pinsText).length, 0);

  return (
    <div className="vd-stack vc-root">
      <Card padded>
        <h3 className="vd-subtitle">Where you serve</h3>
        <p className="vd-note vd-note-tight">
          Define service areas below: country, state, city, and <strong>PIN codes</strong> (one per line in the last
          column). OorjaMan uses this for marketplace matching and visit assignment.
        </p>
        <p className="vd-caption vc-geo-note">
          City lists load offline from open geographic data - no API key required.
        </p>
      </Card>

      <Card padded={false} className="vc-table-card">
        <div className="vc-table-toolbar">
          <Button type="button" variant="outline" size="sm" onClick={addZone}>
            + Add another area
          </Button>
          <span className="vd-caption">
            {zones.length} area{zones.length === 1 ? "" : "s"} · {totalPins} PIN{totalPins === 1 ? "" : "s"} total
          </span>
        </div>

        <div className="vd-table-wrap">
          <table className="vd-table vc-table">
            <thead>
              <tr>
                <th scope="col" className="vc-col-num">
                  #
                </th>
                <th scope="col">Country</th>
                <th scope="col">State / UT</th>
                <th scope="col">City</th>
                <th scope="col" className="vc-col-pins">
                  PIN codes
                </th>
                <th scope="col" className="vc-col-actions">
                  <span className="vc-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageZones.map((zone, rowIndex) => (
                <CoverageZoneTableRow
                  key={zone.id}
                  rowNumber={(page - 1) * COVERAGE_PAGE_SIZE + rowIndex + 1}
                  zone={zone}
                  countries={countries}
                  canRemove={zones.length > 1}
                  onChange={(patch) => updateZone(zone.id, patch)}
                  onRemove={() => removeZone(zone.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="vc-table-footer">
          <TablePaginationBar
            page={page}
            pageSize={COVERAGE_PAGE_SIZE}
            total={zones.length}
            onPageChange={setPage}
          />
        </div>
      </Card>

      <Card padded>
        <h3 className="vd-subtitle">Availability</h3>
        <p className="vd-note vd-note-tight">Dates when your organisation cannot accept new visits.</p>
        <TextArea
          label="Blackout dates (one ISO date per line)"
          value={blackoutText}
          onChange={(e) => setBlackoutText(e.target.value)}
          placeholder="2026-12-25&#10;2026-11-15"
          rows={3}
        />
      </Card>

      {error ? <p className="vd-error">{error}</p> : null}
      {totalPins === 0 ? (
        <p className="vd-caption vc-warn">
          Add at least one PIN in the table before saving - otherwise you may not appear in local marketplace results.
        </p>
      ) : null}

      <div className="vd-top-gap">
        <Button type="button" loading={saving} disabled={!vendor} onClick={() => void save()}>
          Save service coverage
        </Button>
      </div>
    </div>
  );
}

function CoverageZoneTableRow({
  rowNumber,
  zone,
  countries,
  canRemove,
  onChange,
  onRemove,
}: {
  rowNumber: number;
  zone: ZoneEditorState;
  countries: ReturnType<typeof listCountries>;
  canRemove: boolean;
  onChange: (patch: Partial<ZoneEditorState>) => void;
  onRemove: () => void;
}) {
  const states = useMemo(() => listStatesForCountry(zone.country_code), [zone.country_code]);
  const cities = useMemo(
    () => listCitiesForState(zone.country_code, zone.state_code),
    [zone.country_code, zone.state_code],
  );
  const cityListId = `vc-city-${zone.id}`;
  const pinCount = coverageZonePinsFromText(zone.pinsText).length;

  return (
    <tr>
      <td className="vc-col-num vd-muted">{rowNumber}</td>
      <td>
        <select
          className="vd-select vc-cell-select"
          aria-label={`Country for area ${rowNumber}`}
          value={zone.country_code}
          onChange={(e) => {
            const code = e.target.value;
            const c = countryByCode(code);
            onChange({
              country_code: code,
              country_name: c?.name ?? code,
              state_code: "",
              state_name: "",
              city_name: "",
            });
          }}
        >
          {countries.map((c) => (
            <option key={c.isoCode} value={c.isoCode}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="vd-select vc-cell-select"
          aria-label={`State for area ${rowNumber}`}
          value={zone.state_code}
          disabled={!zone.country_code}
          onChange={(e) => {
            const state_code = e.target.value;
            const s = states.find((x) => x.isoCode === state_code);
            onChange({
              state_code,
              state_name: s?.name ?? "",
              city_name: "",
            });
          }}
        >
          <option value="">Select…</option>
          {states.map((s) => (
            <option key={s.isoCode} value={s.isoCode}>
              {s.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        {!zone.state_code ? (
          <span className="vd-caption">Select state</span>
        ) : (
          <>
            <input
              className="vd-select vc-cell-input"
              list={cityListId}
              aria-label={`City for area ${rowNumber}`}
              placeholder="Search or pick city…"
              value={zone.city_name}
              onChange={(e) => onChange({ city_name: e.target.value })}
            />
            <datalist id={cityListId}>
              {cities.map((c) => (
                <option key={`${c.stateCode}-${c.name}`} value={c.name} />
              ))}
            </datalist>
          </>
        )}
      </td>
      <td className="vc-col-pins">
        <textarea
          className="vc-cell-pins"
          aria-label={`PIN codes for area ${rowNumber}`}
          placeholder="560001&#10;560034"
          rows={3}
          value={zone.pinsText}
          onChange={(e) => onChange({ pinsText: e.target.value })}
        />
        <span className="vd-caption vc-pin-count">
          {pinCount} PIN{pinCount === 1 ? "" : "s"}
        </span>
      </td>
      <td className="vc-col-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRemove}
          onClick={onRemove}
          title={canRemove ? "Remove this area" : "At least one area is required"}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}
