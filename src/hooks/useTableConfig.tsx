import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fieldsApi, statusApi, type CustomField, type StatusOption } from "@/lib/customFields";
import { STATUS_OPTIONS } from "@/types";

// Module-level cache so switching views renders instantly and every table
// stays on the same configuration.
let fieldsCache: CustomField[] | null = null;
let statusCache: StatusOption[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function reloadTableConfig() {
  const [fields, statuses] = await Promise.all([fieldsApi.list(), statusApi.list()]);
  fieldsCache = fields;
  statusCache = statuses;
  notify();
}

/**
 * Live table configuration: user-defined columns / sub-columns and the status
 * dropdown options. Any change made in the ADD section is broadcast over
 * realtime so every open warehouse sheet updates immediately.
 */
export function useTableConfig() {
  const [fields, setFields] = useState<CustomField[]>(fieldsCache ?? []);
  const [statuses, setStatuses] = useState<StatusOption[]>(statusCache ?? []);
  const [loading, setLoading] = useState(fieldsCache === null);

  const sync = useCallback(() => {
    setFields(fieldsCache ?? []);
    setStatuses(statusCache ?? []);
  }, []);

  useEffect(() => {
    listeners.add(sync);
    if (fieldsCache === null) {
      reloadTableConfig()
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      sync();
    }
    return () => {
      listeners.delete(sync);
    };
  }, [sync]);

  useEffect(() => {
    const channel = supabase
      .channel(`table_config_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_fields" }, () => {
        void reloadTableConfig().catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_options" }, () => {
        void reloadTableConfig().catch(() => {});
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const statusLabels = statuses.length > 0 ? statuses.map((s) => s.label) : [...STATUS_OPTIONS];

  return { fields, statuses, statusLabels, loading, reload: reloadTableConfig };
}

/** Columns visible for a warehouse sheet, as parent groups with sub-columns. */
export type FieldGroup = { field: CustomField; children: CustomField[] };

export function buildFieldGroups(fields: CustomField[], scope?: "Guangzhou" | "Yiwu"): FieldGroup[] {
  const inScope = (f: CustomField) => f.scope === "both" || (scope ? f.scope === scope : false);
  const parents = fields.filter((f) => !f.parentId && inScope(f));
  return parents.map((field) => ({
    field,
    children: fields.filter((c) => c.parentId === field.id && inScope(c)),
  }));
}
