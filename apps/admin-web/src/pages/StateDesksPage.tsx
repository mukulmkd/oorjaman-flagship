import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOperationStaff,
  listOperationStates,
  queryKeys,
  saveOperationStaffAssignment,
  type OperationAccess,
  type OperationStaffMember,
} from "@oorjaman/api";
import { Button, Card, Input, PageHeader } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import "./state-desks-page.css";

function initials(name: string | null, email: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function StateDesksPage() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<OperationAccess>("state");
  const [stateIds, setStateIds] = useState<string[]>([]);
  const [stateQuery, setStateQuery] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  const statesQuery = useQuery({
    queryKey: queryKeys.bookings.operationStates(),
    queryFn: () => listOperationStates(supabase!),
    enabled: Boolean(supabase),
  });
  const staffQuery = useQuery({
    queryKey: queryKeys.bookings.operationStaff(),
    queryFn: () => listOperationStaff(supabase!),
    enabled: Boolean(supabase),
  });

  const stateNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const state of statesQuery.data ?? []) names.set(state.id, state.name);
    return names;
  }, [statesQuery.data]);

  const filteredStates = useMemo(() => {
    const needle = stateQuery.trim().toLowerCase();
    const states = statesQuery.data ?? [];
    if (!needle) return states;
    return states.filter((state) => state.name.toLowerCase().includes(needle));
  }, [stateQuery, statesQuery.data]);

  const selectedStates = useMemo(
    () =>
      stateIds
        .map((id) => ({ id, name: stateNameById.get(id) ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [stateIds, stateNameById],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveOperationStaffAssignment(supabase!, {
        email,
        access,
        stateIds: access === "national" ? [] : stateIds,
      }),
    onSuccess: async () => {
      setFormError(null);
      setSavedFor(email.trim().toLowerCase());
      setEmail("");
      setStateIds([]);
      setStateQuery("");
      setAccess("state");
      setEditingUserId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.operationStaff() });
    },
    onError: (error: Error) => {
      setSavedFor(null);
      setFormError(error.message);
    },
  });

  function toggleState(id: string) {
    setSavedFor(null);
    setStateIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function loadStaff(person: OperationStaffMember) {
    setEmail(person.email ?? "");
    setAccess(person.role === "admin" ? "national" : "state");
    setStateIds(person.role === "admin" ? [] : person.stateIds);
    setStateQuery("");
    setEditingUserId(person.userId);
    setFormError(null);
    setSavedFor(null);
  }

  function clearForm() {
    setEmail("");
    setAccess("state");
    setStateIds([]);
    setStateQuery("");
    setEditingUserId(null);
    setFormError(null);
    setSavedFor(null);
  }

  const editingPerson = (staffQuery.data ?? []).find((person) => person.userId === editingUserId) ?? null;

  return (
    <div className="state-desks-layout">
      <PageHeader
        title="State desks"
        subtitle="Give a staff login country-wide access, or limit them to the states they operate."
      />

      <div className="state-desks-grid">
        <Card padded className="state-desks-panel">
          <div className="state-desks-panel-head">
            <div>
              <h2>Assign access</h2>
              <p>The person must have signed in once with this email.</p>
            </div>
            {editingPerson ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearForm}>
                Clear
              </Button>
            ) : null}
          </div>

          <form
            className="state-desks-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSavedFor(null);
              saveMutation.mutate();
            }}
          >
            <Input
              label="Staff email"
              type="email"
              autoComplete="off"
              placeholder="name@oorjaman.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEditingUserId(null);
                setSavedFor(null);
              }}
              required
            />

            <fieldset className="state-desks-access">
              <legend className="sr-only">Access level</legend>
              <label className={access === "national" ? "is-selected" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name="operation-access"
                  checked={access === "national"}
                  onChange={() => {
                    setAccess("national");
                    setSavedFor(null);
                  }}
                />
                <span className="state-desks-access-title">National admin</span>
                <span className="state-desks-access-copy">Bookings, vendors, and analytics for every state.</span>
              </label>
              <label className={access === "state" ? "is-selected" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name="operation-access"
                  checked={access === "state"}
                  onChange={() => {
                    setAccess("state");
                    setSavedFor(null);
                  }}
                />
                <span className="state-desks-access-title">State desk</span>
                <span className="state-desks-access-copy">Only the states you select below.</span>
              </label>
            </fieldset>

            {access === "national" ? (
              <p className="state-desks-note">
                Use this for headquarters logins such as admin@oorjaman.com and partners@oorjaman.com.
              </p>
            ) : (
              <div className="state-desks-states">
                <div className="state-desks-states-head">
                  <span>States</span>
                  <span>
                    {stateIds.length === 0 ? "None selected" : `${stateIds.length} selected`}
                  </span>
                </div>

                {selectedStates.length > 0 ? (
                  <ul className="state-desks-selected">
                    {selectedStates.map((state) => (
                      <li key={state.id}>
                        <button type="button" onClick={() => toggleState(state.id)}>
                          {state.name}
                          <span aria-hidden>×</span>
                          <span className="sr-only">Remove {state.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Input
                  label=""
                  type="search"
                  placeholder="Search states"
                  value={stateQuery}
                  onChange={(event) => setStateQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  aria-label="Search states"
                />

                <div className="state-desks-state-list" role="group" aria-label="States">
                  {statesQuery.isLoading ? <p className="state-desks-note">Loading states…</p> : null}
                  {statesQuery.error ? (
                    <p className="state-desks-error">{(statesQuery.error as Error).message}</p>
                  ) : null}
                  {!statesQuery.isLoading && filteredStates.length === 0 ? (
                    <p className="state-desks-note">No state matches that search.</p>
                  ) : null}
                  {filteredStates.map((state) => {
                    const selected = stateIds.includes(state.id);
                    return (
                      <button
                        key={state.id}
                        type="button"
                        className={selected ? "is-selected" : ""}
                        aria-pressed={selected}
                        onClick={() => toggleState(state.id)}
                      >
                        <span className="state-desks-check" aria-hidden />
                        {state.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {formError ? <p className="state-desks-error">{formError}</p> : null}
            {savedFor ? <p className="state-desks-success">Saved {savedFor}.</p> : null}

            <div className="state-desks-actions">
              <Button type="submit" disabled={saveMutation.isPending || !supabase}>
                {saveMutation.isPending ? "Saving…" : editingPerson ? "Update assignment" : "Save assignment"}
              </Button>
            </div>
          </form>
        </Card>

        <Card padded className="state-desks-panel">
          <div className="state-desks-panel-head">
            <div>
              <h2>Current staff</h2>
              <p>Select someone to edit their desk.</p>
            </div>
          </div>

          {staffQuery.isLoading ? <p className="state-desks-note">Loading staff…</p> : null}
          {staffQuery.error ? <p className="state-desks-error">{(staffQuery.error as Error).message}</p> : null}
          {!staffQuery.isLoading && (staffQuery.data ?? []).length === 0 ? (
            <p className="state-desks-note">No operations staff yet.</p>
          ) : null}

          <ul className="state-desks-list">
            {(staffQuery.data ?? []).map((person) => {
              const national = person.role === "admin";
              const states = person.stateIds.map((id) => stateNameById.get(id) ?? id);
              const active = person.userId === editingUserId;
              return (
                <li key={person.userId}>
                  <button
                    type="button"
                    className={active ? "state-desks-person is-active" : "state-desks-person"}
                    onClick={() => loadStaff(person)}
                  >
                    <span className="state-desks-avatar" aria-hidden>
                      {initials(person.fullName, person.email)}
                    </span>
                    <span className="state-desks-person-copy">
                      <strong>{person.fullName || person.email || "Staff"}</strong>
                      <span>{person.email || "No email"}</span>
                    </span>
                    <span className="state-desks-person-access">
                      {national ? (
                        <span className="state-desks-pill state-desks-pill--national">National</span>
                      ) : states.length > 0 ? (
                        states.map((name) => (
                          <span key={name} className="state-desks-pill">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="state-desks-pill">No state</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
