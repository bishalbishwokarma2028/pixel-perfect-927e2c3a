import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Re-runs `onChange` whenever another user inserts, updates or deletes a row
 * in `table`, so every open dashboard stays in sync without a refresh.
 */
export function useRealtimeRefresh(table: "consignments" | "notes", onChange: () => void) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    let timer: number | undefined;
    const channel = supabase
      .channel(`realtime_${table}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => handler.current(), 250);
      })
      .subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table]);
}
