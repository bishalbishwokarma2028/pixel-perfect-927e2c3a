import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fieldsApi,
  statusApi,
  columnSettingsApi,
  type CustomField,
  type StatusOption,
  type ColumnSetting,
} from "@/lib/customFields";
import { STATUS_OPTIONS } from "@/types";

// Module-level cache so switching views renders instantly and every table
// stays on the same configuration.
let fieldsCache: CustomField[] | null = null;
let statusCache: StatusOption[] | null = null;
let columnCache: ColumnSetting[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function reloadTableConfig() {
  const [fields, statuses, columns] = await Promise.all([
    fieldsApi.list(),
    statusApi.list(),
    columnSettingsApi.list().catch(() => [] as ColumnSetting[]),
  ]);
  fieldsCache = fields;
  statusCache = statuses;
  columnCache = columns;
  notify();
}

/**
 * Live table configuration: user-defined columns / sub-columns, the status
 * dropdown options and the built-in column overrides (rename / hide). Any
 * change made in the ADD section is broadcast over realtime so every open
 * warehouse sheet updates immediately.
 */
export function useTableConfig() {
  const [fields, setFields] = useState<CustomField[]>(fieldsCache ?? []);
  const [statuses, setStatuses] = useState<StatusOption[]>(statusCache ?? []);
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(columnCache ?? []);
  const [loading, setLoading] = useState(fieldsCache === null);

  const sync = useCallback(() => {
    setFields(fieldsCache ?? []);
    setStatuses(statusCache ?? []);
    setColumnSettings(columnCache ?? []);
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
    const refresh = () => {
      void reloadTableConfig().catch(() => {});
    };
    const channel = supabase
      .channel(`table_config_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_fields" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_options" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "column_settings" }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const statusLabels = statuses.length > 0 ? statuses.map((s) => s.label) : [...STATUS_OPTIONS];

  const columnLabel = useCallback(
    (key: string, fallback: string) => {
      const s = columnSettings.find((c) => c.key === key);
      return s?.label && s.label.trim() ? s.label : fallback;
    },
    [columnSettings],
  );

  const isColumnHidden = useCallback(
    (key: string) => columnSettings.some((c) => c.key === key && c.hidden),
    [columnSettings],
  );

  return {
    fields,
    statuses,
    statusLabels,
    columnSettings,
    columnLabel,
    isColumnHidden,
    loading,
    reload: reloadTableConfig,
  };
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
