import { useMemo, useState } from "react";
import { matchesQuery } from "@/lib/lead";
import type { Lead, Programme } from "@/types";

export const UNASSIGNED = "__unassigned";

/** Search + programme + owner filters shared by the list pages. */
export function useLeadFilters(leads: Lead[] | undefined) {
  const [query, setQuery] = useState("");
  const [programme, setProgramme] = useState<Programme | "">("");
  const [owner, setOwner] = useState("");

  const filtered = useMemo(
    () =>
      (leads ?? []).filter(
        (lead) =>
          matchesQuery(lead, query) &&
          (!programme || lead.program === programme) &&
          (!owner || (owner === UNASSIGNED ? !lead.owner : lead.owner === owner)),
      ),
    [leads, query, programme, owner],
  );

  const owners = useMemo(
    () => [...new Set((leads ?? []).map((l) => l.owner).filter(Boolean))].sort(),
    [leads],
  );

  const active = Boolean(query || programme || owner);
  const reset = () => {
    setQuery("");
    setProgramme("");
    setOwner("");
  };

  return { query, setQuery, programme, setProgramme, owner, setOwner, owners, filtered, active, reset };
}

export type LeadFilters = ReturnType<typeof useLeadFilters>;
