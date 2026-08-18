import { supabase } from "@/integrations/supabase/client";

export type FieldScope = "both" | "Guangzhou" | "Yiwu";
export type FieldType = "text" | "number" | "date";

export type CustomField = {
  id: string;
  scope: FieldScope;
  parentId: string | null;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  sortOrder: number;
};

export type StatusOption = {
  id: string;
  label: string;
  sortOrder: number;
};

type FieldRow = {
  id: string;
  scope: string;
  parent_id: string | null;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
};

function toField(r: FieldRow): CustomField {
  return {
    id: r.id,
    scope: (r.scope as FieldScope) ?? "both",
    parentId: r.parent_id,
    fieldKey: r.field_key,
    label: r.label,
    fieldType: (r.field_type as FieldType) ?? "text",
    sortOrder: r.sort_order ?? 0,
  };
}

export function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "field"}_${Math.random().toString(36).slice(2, 7)}`;
}

export const fieldsApi = {
  async list(): Promise<CustomField[]> {
    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as unknown as FieldRow[]).map(toField);
  },

  async create(input: {
    label: string;
    scope: FieldScope;
    fieldType: FieldType;
    parentId?: string | null;
  }): Promise<CustomField> {
    const { data, error } = await supabase
      .from("custom_fields")
      .insert({
        label: input.label.trim(),
        scope: input.scope,
        field_type: input.fieldType,
        parent_id: input.parentId ?? null,
        field_key: slugify(input.label),
        sort_order: Date.now() % 100000,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toField(data as unknown as FieldRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("custom_fields").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export const statusApi = {
  async list(): Promise<StatusOption[]> {
    const { data, error } = await supabase
      .from("status_options")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as unknown as { id: string; label: string; sort_order: number }[]).map((r) => ({
      id: r.id,
      label: r.label,
      sortOrder: r.sort_order ?? 0,
    }));
  },

  async create(label: string): Promise<StatusOption> {
    const { data, error } = await supabase
      .from("status_options")
      .insert({ label: label.trim(), sort_order: Date.now() % 100000 } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const r = data as unknown as { id: string; label: string; sort_order: number };
    return { id: r.id, label: r.label, sortOrder: r.sort_order };
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("status_options").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
