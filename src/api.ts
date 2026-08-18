import { supabase } from "@/integrations/supabase/client";
import { askAssistant } from "@/lib/ai.functions";
import type { Consignment, NoteItem, TransitPoint, TransitData } from "./types";

type ConsignmentRow = {
  id: string;
  origin: string;
  date: string;
  consignment_no: string;
  lot_no: string | null;
  container?: string | null;
  dispatched_date?: string | null;
  marka: string;
  total_ctn: number;
  loaded_ctn?: number | null;

  cbm: number;
  gw: number;
  destination: string;
  status: string;
  client_name: string;
  remarks: string;
  transit_points: unknown;
  created_at: number;
  updated_at: number;
};

const now = () => Date.now();

function rowToConsignment(row: ConsignmentRow): Consignment {
  return {
    id: row.id,
    origin: (row.origin as Consignment["origin"]) ?? "Guangzhou",
    date: row.date ?? "",
    consignmentNo: row.consignment_no ?? "",
    lotNo: row.lot_no ?? undefined,
    container: row.container ?? undefined,
    dispatchedDate: row.dispatched_date ?? undefined,
    marka: row.marka ?? "",
    totalCtn: Number(row.total_ctn ?? 0),
    loadedCtn: row.loaded_ctn === null || row.loaded_ctn === undefined ? null : Number(row.loaded_ctn),

    cbm: Number(row.cbm ?? 0),
    gw: Number(row.gw ?? 0),
    destination: row.destination ?? "",
    status: row.status as Consignment["status"],
    clientName: row.client_name ?? "",
    remarks: row.remarks ?? "",
    transitPoints: (row.transit_points ?? {}) as Partial<Record<TransitPoint, TransitData>>,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
  };
}

function consignmentToRow(c: Partial<Consignment>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (c.id !== undefined) row["id"] = c.id;
  if (c.origin !== undefined) row["origin"] = c.origin;
  if (c.date !== undefined) row["date"] = c.date;
  if (c.consignmentNo !== undefined) row["consignment_no"] = c.consignmentNo;
  if (c.lotNo !== undefined) row["lot_no"] = c.lotNo;
  if (c.container !== undefined) row["container"] = c.container ?? "";
  if (c.dispatchedDate !== undefined) row["dispatched_date"] = c.dispatchedDate ?? "";
  if (c.marka !== undefined) row["marka"] = c.marka;
  if (c.totalCtn !== undefined) row["total_ctn"] = Number(c.totalCtn) || 0;
  if (c.loadedCtn !== undefined)
    row["loaded_ctn"] = c.loadedCtn === null ? null : Number(c.loadedCtn);

  if (c.cbm !== undefined) row["cbm"] = Number(c.cbm) || 0;
  if (c.gw !== undefined) row["gw"] = Number(c.gw) || 0;
  if (c.destination !== undefined) row["destination"] = c.destination;
  if (c.status !== undefined) row["status"] = c.status;
  if (c.clientName !== undefined) row["client_name"] = c.clientName;
  if (c.remarks !== undefined) row["remarks"] = c.remarks;
  if (c.transitPoints !== undefined) row["transit_points"] = c.transitPoints;
  if (c.createdAt !== undefined) row["created_at"] = c.createdAt;
  if (c.updatedAt !== undefined) row["updated_at"] = c.updatedAt;
  return row;
}

type NoteRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  audio_transcription: string | null;
  audio_data_url: string | null;
  audio_duration: number | null;
  is_pinned: boolean;
  color_theme: string;
  linked_consignment_no: string | null;
  linked_marka: string | null;
  created_at: number;
  updated_at: number;
};

function rowToNote(row: NoteRow): NoteItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    category: row.category as NoteItem["category"],
    imageUrl: row.image_url ?? undefined,
    audioTranscription: row.audio_transcription ?? undefined,
    audioDataUrl: row.audio_data_url ?? undefined,
    audioDuration: row.audio_duration === null ? undefined : Number(row.audio_duration),
    isPinned: Boolean(row.is_pinned),
    colorTheme: (row.color_theme as NoteItem["colorTheme"]) ?? "amber",
    linkedConsignmentNo: row.linked_consignment_no ?? undefined,
    linkedMarka: row.linked_marka ?? undefined,
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
  };
}

function noteToRow(n: Partial<NoteItem>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (n.id !== undefined) row["id"] = n.id;
  if (n.title !== undefined) row["title"] = n.title || "Untitled Note";
  if (n.content !== undefined) row["content"] = n.content ?? "";
  if (n.category !== undefined) row["category"] = n.category;
  if (n.imageUrl !== undefined) row["image_url"] = n.imageUrl ?? null;
  if (n.audioTranscription !== undefined) row["audio_transcription"] = n.audioTranscription ?? null;
  if (n.audioDataUrl !== undefined) row["audio_data_url"] = n.audioDataUrl ?? null;
  if (n.audioDuration !== undefined) row["audio_duration"] = n.audioDuration ?? null;
  if (n.isPinned !== undefined) row["is_pinned"] = Boolean(n.isPinned);
  if (n.colorTheme !== undefined) row["color_theme"] = n.colorTheme ?? "amber";
  if (n.linkedConsignmentNo !== undefined) row["linked_consignment_no"] = n.linkedConsignmentNo ?? null;
  if (n.linkedMarka !== undefined) row["linked_marka"] = n.linkedMarka ?? null;
  return row;
}

function fail(message: string, error: { message: string } | null): never {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
}

export const api = {
  async getConsignments(): Promise<Consignment[]> {
    const { data, error } = await supabase
      .from("consignments")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) fail("Failed to fetch data", error);
    return (data as unknown as ConsignmentRow[]).map(rowToConsignment);
  },

  async addConsignments(items: Partial<Consignment>[]): Promise<{ success: boolean; added: number }> {
    const ts = now();
    const rows = items.map((item) =>
      consignmentToRow({
        transitPoints: {},
        ...item,
        id: item.id ?? crypto.randomUUID(),
        createdAt: item.createdAt ?? ts,
        updatedAt: ts,
      }),
    );
    const { error } = await supabase.from("consignments").insert(rows as never);
    if (error) fail("Failed to import data", error);
    return { success: true, added: rows.length };
  },

  async bulkEdit(
    ids: string[],
    updates: Partial<Consignment>,
  ): Promise<{ success: boolean; updatedCount: number }> {
    if (ids.length === 0) return { success: true, updatedCount: 0 };
    let updatedCount = 0;
    // Transit points merge per row, so update individually.
    if (updates.transitPoints) {
      const { data, error } = await supabase
        .from("consignments")
        .select("id, transit_points")
        .in("id", ids);
      if (error) fail("Failed to update data", error);
      const existing = new Map(
        (data as unknown as { id: string; transit_points: Record<string, TransitData> }[]).map(
          (r) => [r.id, r.transit_points ?? {}],
        ),
      );
      for (const id of ids) {
        const merged: Record<string, TransitData> = { ...(existing.get(id) ?? {}) };
        for (const [tp, tpData] of Object.entries(updates.transitPoints)) {
          if (tpData) merged[tp] = { ...(merged[tp] ?? {}), ...tpData } as TransitData;
        }
        const { error: upErr } = await supabase
          .from("consignments")
          .update(consignmentToRow({ ...updates, transitPoints: merged as never, updatedAt: now() }) as never)
          .eq("id", id);
        if (upErr) fail("Failed to update data", upErr);
        updatedCount++;
      }
      return { success: true, updatedCount };
    }

    const { data, error } = await supabase
      .from("consignments")
      .update(consignmentToRow({ ...updates, updatedAt: now() }) as never)
      .in("id", ids)
      .select("id");
    if (error) fail("Failed to update data", error);
    return { success: true, updatedCount: (data as unknown as { id: string }[]).length };
  },

  async updateConsignment(id: string, updates: Partial<Consignment>): Promise<Consignment> {
    const { data, error } = await supabase
      .from("consignments")
      .update(consignmentToRow({ ...updates, updatedAt: now() }) as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Failed to update data", error);
    return rowToConsignment(data as unknown as ConsignmentRow);
  },

  async bulkDelete(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (ids.length === 0) return { success: true, deletedCount: 0 };
    const { data, error } = await supabase
      .from("consignments")
      .delete()
      .in("id", ids)
      .select("id");
    if (error) fail("Failed to delete data", error);
    return { success: true, deletedCount: (data as unknown as { id: string }[]).length };
  },

  async deleteConsignment(id: string): Promise<{ success: boolean }> {
    const { error } = await supabase.from("consignments").delete().eq("id", id);
    if (error) fail("Failed to delete data", error);
    return { success: true };
  },

  async getNotes(): Promise<NoteItem[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) fail("Failed to fetch notes", error);
    return (data as unknown as NoteRow[]).map(rowToNote);
  },

  async createNote(note: Partial<NoteItem>): Promise<NoteItem> {
    const ts = now();
    const row = {
      ...noteToRow({ category: "General", colorTheme: "amber", isPinned: false, ...note }),
      id: `note_${ts}_${Math.random().toString(36).slice(2, 8)}`,
      created_at: ts,
      updated_at: ts,
    };
    const { data, error } = await supabase
      .from("notes")
      .insert(row as never)
      .select("*")
      .single();
    if (error) fail("Failed to create note", error);
    return rowToNote(data as unknown as NoteRow);
  },

  async updateNote(id: string, updates: Partial<NoteItem>): Promise<NoteItem> {
    const { data, error } = await supabase
      .from("notes")
      .update({ ...noteToRow(updates), updated_at: now() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Failed to update note", error);
    return rowToNote(data as unknown as NoteRow);
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) fail("Failed to delete note", error);
    return { success: true };
  },

  async chat(message: string): Promise<string> {
    return askAssistant({ data: { message } });
  },
};
