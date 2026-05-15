import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TableName =
  | "appointments"
  | "appointment_slots"
  | "blocks"
  | "block_slots";

export type TableFilter = {
  table: TableName;
  filters: string[];
};

export type RealtimeInvalidationSpec = {
  client: SupabaseClient;
  channelName: string;
  tableFilters: TableFilter[];
  invalidate: () => void;
  enabled?: boolean;
  debounceMs?: number;
};

export function useRealtimeInvalidation({
  client,
  channelName,
  tableFilters,
  invalidate,
  enabled = true,
  debounceMs = 0,
}: RealtimeInvalidationSpec): void {
  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;

  const tableFiltersKey = JSON.stringify(tableFilters);

  useEffect(() => {
    if (!enabled) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      if (debounceMs > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          invalidateRef.current();
        }, debounceMs);
      } else {
        invalidateRef.current();
      }
    };

    const parsed = JSON.parse(tableFiltersKey) as TableFilter[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel = client.channel(channelName) as any;

    for (const { table, filters } of parsed) {
      if (filters.length === 0) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          handleChange
        );
      } else {
        for (const filter of filters) {
          channel = channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table, filter },
            handleChange
          );
        }
      }
    }

    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
  // tableFiltersKey içerik-bazlı dep karşılaştırması sağlar; invalidate ref'e alındı
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, channelName, tableFiltersKey, enabled, debounceMs]);
}
