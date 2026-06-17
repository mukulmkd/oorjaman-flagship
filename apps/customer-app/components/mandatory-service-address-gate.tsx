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
import { supabase } from "../lib/supabase";

type Props = {
  customer: CustomerRow;
  /** Called when the user clears the session address gate (safe to show OS permission dialogs). */
  onGateReleased?: () => void;
};

/**
 * Every app session: blocks main tabs until the user taps a saved address (or adds their first one).
 * Swiggy-style: no separate "continue" button on the sheet; optional GPS to prefill the add form.
 */
export function MandatoryServiceAddressGate({ customer, onGateReleased }: Props) {
  const qc = useQueryClient();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const prevIdRef = useRef(customer.id);

  useEffect(() => {
    if (prevIdRef.current !== customer.id) {
      setSessionDismissed(false);
      prevIdRef.current = customer.id;
    }
  }, [customer.id]);

  const { entries, defaultId } = readServiceAddressBook(customer);

  const addressMut = useMutation({
    mutationFn: async (payload: { entries: ServiceAddressEntry[]; defaultId: string | null; extras?: ServiceAddressSaveExtras }) => {
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
        setSessionDismissed(true);
        onGateReleased?.();
      }}
    />
  );
}
