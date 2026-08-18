import type { View } from "../views";

export type ModuleId = Exclude<View, "staff">;

export const MODULES: { id: ModuleId; label: string }[] = [
  { id: "dashboard", label: "Dashboard Overview" },
  { id: "inventory", label: "Inventory Stock" },
  { id: "guangzhou", label: "Guangzhou Warehouse" },
  { id: "yiwu", label: "Yiwu Warehouse" },
  { id: "lots", label: "Lot Batch Manager" },
  { id: "clients", label: "Client Directory" },
  { id: "notes", label: "Notes & Voice Memos" },
  { id: "analytics", label: "Freight Analytics" },
  { id: "ai", label: "ADO's Assistant" },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

export type ModulePermission = { canView: boolean; canEdit: boolean };
export type PermissionMap = Record<string, ModulePermission>;

export type StaffMember = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: "admin" | "staff";
  permissions: PermissionMap;
};

export function emptyPermissions(): PermissionMap {
  return Object.fromEntries(MODULE_IDS.map((id) => [id, { canView: false, canEdit: false }]));
}
