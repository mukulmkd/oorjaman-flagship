import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOperationStaff,
  listOperationStates,
  queryKeys,
  saveOperationStaffAssignment,
  type OperationAccess,
} from "@oorjaman/api";
import { Button, Card, Input, PageHeader } from "@oorjaman/web-ui";
import { useSupabase } from "@oorjaman/web-ui";
import "./state-desks-page.css";

export function StateDesksPage() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<OperationAccess>("state");
  const [stateIds, setStateIds] = useState<string[]>([]);
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
      setAccess("state");
      await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.operationStaff() });
    },
    onError: (error: Error) => {
      setSavedFor(null);
      setFormError(error.message);
    },
  });

  function toggleState(id: string) {
    setStateIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="state-desks-layout">
      <PageHeader
        title="State desks"
        subtitle="National admins see every state. A state desk sees bookings and analytics only for the states you assign."
      />

      <Card>
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <div className="state-desks-access">
            <label>
              <input
                type="radio"
                name="operation-access"
                checked={access === "national"}
                onChange={() => setAccess("national")}
              />
              National admin
            </label>
            <label>
              <input
                type="radio"
                name="operation-access"
                checked={access === "state"}
                onChange={() => setAccess("state")}
              />
              State desk
            </label>
          </div>
          {access === "state" ? (
            <fieldset className="state-desks-states">
              <legend>States</legend>
              {(statesQuery.data ?? []).map((state) => (
                <label key={state.id}>
                  <input
                    type="checkbox"
                    checked={stateIds.includes(state.id)}
                    onChange={() => toggleState(state.id)}
                  />
                  {state.name}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="state-desks-note">
              This login keeps country-wide bookings and analytics. Use this for admin@oorjaman.com and
              partners@oorjaman.com.
            </p>
          )}
          {formError ? <p className="state-desks-error">{formError}</p> : null}
          {savedFor ? <p className="state-desks-note">Saved {savedFor}.</p> : null}
          <Button type="submit" disabled={saveMutation.isPending || !supabase}>
            {saveMutation.isPending ? "Saving…" : "Save assignment"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2>Current staff</h2>
        {staffQuery.isLoading ? <p className="state-desks-note">Loading staff…</p> : null}
        {staffQuery.error ? <p className="state-desks-error">{(staffQuery.error as Error).message}</p> : null}
        <ul className="state-desks-list">
          {(staffQuery.data ?? []).map((person) => {
            const states = person.stateIds.map((id) => stateNameById.get(id) ?? id).join(", ");
            return (
              <li key={person.userId} className="state-desks-person">
                <div>
                  <strong>{person.fullName || person.email || "Staff"}</strong>
                  <p>{person.email}</p>
                </div>
                <p>{person.role === "admin" ? "National" : states || "No state assigned"}</p>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
