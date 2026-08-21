import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerRow } from "@oorjaman/api";
import { customerApi, queryKeys } from "@oorjaman/api";
import { ServiceAddressPickerSheet } from "./service-address-picker-sheet";
import {
  buildAddressBookPatch,
  mergeServiceGpsIntoCustomerPatch,
  readServiceAddressBook,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../lib/service-address-book";
import {
  isSessionAddressGateDismissed,
  markSessionAddressGateDismissed,
} from "../lib/session-address-gate";
import { supabase } from "../lib/supabase";

type Props = {
  customer: CustomerRow;
  /** Called when the user clears the session address gate (safe to show OS permission dialogs). */
  onGateReleased?: () => void;
};

/**
 * Every app session: blocks main tabs until the user taps a saved address (or adds their first one).
 * Dismissal is module-scoped so remounting (main) after /book does not re-prompt.
 */
export function MandatoryServiceAddressGate({ customer, onGateReleased }: Props) {
  const qc = useQueryClient();
  const [sessionDismissed, setSessionDismissed] = useState(() =>
    isSessionAddressGateDismissed(customer.id),
  );
  const prevIdRef = useRef(customer.id);
  const releasedRef = useRef(false);

  useEffect(() => {
    if (prevIdRef.current !== customer.id) {
      prevIdRef.current = customer.id;
      releasedRef.current = false;
      const already = isSessionAddressGateDismissed(customer.id);
      setSessionDismissed(already);
    }
  }, [customer.id]);

  useEffect(() => {
    if (!sessionDismissed || releasedRef.current) return;
    releasedRef.current = true;
    onGateReleased?.();
  }, [sessionDismissed, onGateReleased]);

  const { entries, defaultId } = readServiceAddressBook(customer);

  const addressMut = useMutation({
    mutationFn: async (payload: {
      entries: ServiceAddressEntry[];
      defaultId: string | null;
      extras?: ServiceAddressSaveExtras;
    }) => {
      if (!supabase) throw new Error("Not connected.");
      const base = buildAddressBookPatch(customer, payload.entries, payload.defaultId);
      return customerApi.updateMyCustomer(supabase, mergeServiceGpsIntoCustomerPatch(base, payload.extras));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    },
  });

  return (
    <ServiceAddressPickerSheet
      visible={!sessionDismissed}
      entries={entries}
      defaultId={defaultId}
      onClose={() => {}}
      onSave={async (nextEntries, nextDefaultId, extras) => {
        await addressMut.mutateAsync({ entries: nextEntries, defaultId: nextDefaultId, extras });
        markSessionAddressGateDismissed(customer.id);
        setSessionDismissed(true);
      }}
    />
  );
}
