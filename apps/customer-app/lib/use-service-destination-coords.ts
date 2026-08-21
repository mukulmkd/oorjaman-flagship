import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CustomerRow } from "@oorjaman/api";
import { customerApi, queryKeys } from "@oorjaman/api";
import { supabase } from "./supabase";
import { resolveServiceDestinationCoords, type ServiceDestinationCoords } from "./service-address-book";

/** Service-site GPS for live tracking (never the phone's current location). */
export function useServiceDestinationCoords(
  serviceAddressId?: string | null,
): {
  coords: ServiceDestinationCoords | null;
  customer: CustomerRow | null | undefined;
  isPending: boolean;
} {
  const customerQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const coords = useMemo(
    () => resolveServiceDestinationCoords(customerQ.data, serviceAddressId),
    [customerQ.data, serviceAddressId],
  );

  return {
    coords,
    customer: customerQ.data,
    isPending: customerQ.isPending,
  };
}
