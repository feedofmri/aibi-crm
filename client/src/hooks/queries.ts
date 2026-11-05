import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadsApi, metaApi, usersApi } from "@/api/endpoints";
import type { Lead, LeadChanges } from "@/types";

export const queryKeys = {
  meta: ["meta"] as const,
  leads: ["leads"] as const,
  users: ["users"] as const,
  automation: ["automation"] as const,
  weekly: (end: string) => ["reports", "weekly", end] as const,
};

export function useMeta() {
  return useQuery({ queryKey: queryKeys.meta, queryFn: metaApi.get, staleTime: Infinity });
}

export function useLeads() {
  return useQuery({ queryKey: queryKeys.leads, queryFn: leadsApi.list, refetchInterval: 60_000 });
}

export function useLead(id: string | null) {
  const leads = useLeads();
  return { ...leads, data: id ? leads.data?.find((lead) => lead.id === id) : undefined };
}

export function useTeam() {
  return useQuery({ queryKey: queryKeys.users, queryFn: usersApi.list, staleTime: 5 * 60_000 });
}

/** Put a server-returned lead into the cached list (no refetch needed). */
export function useReplaceLead() {
  const queryClient = useQueryClient();
  return (lead: Lead) =>
    queryClient.setQueryData<Lead[]>(queryKeys.leads, (all) => {
      if (!all) return all;
      const exists = all.some((l) => l.id === lead.id);
      return exists ? all.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...all];
    });
}

/** Optimistic lead update (used for drag-and-drop stage changes). */
export function useUpdateLead() {
  const queryClient = useQueryClient();
  const replace = useReplaceLead();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: LeadChanges }) => leadsApi.update(id, changes),
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads });
      const previous = queryClient.getQueryData<Lead[]>(queryKeys.leads);
      queryClient.setQueryData<Lead[]>(queryKeys.leads, (all) =>
        all?.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.leads, context.previous);
    },
    onSuccess: (lead) => replace(lead),
  });
}
