/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TRANSIT_POINTS = [
  'LHASA',
  'NYLAM',
  'TATOPANI',
  'KERUNG',
  'RASUWA',
] as const;

export type TransitPoint = typeof TRANSIT_POINTS[number];

export const STATUS_OPTIONS = [
  'Pending in Guangzhou',
  'Pending in Yiwu',
  'On the way to Lhasa',
  'At Lhasa',
  'On the way to Nyalam',
  'At Nyalam',
  'On the way to Kerung',
  'At Kerung',
  'On the way to Tatopani',
  'At Tatopani',
  'On the way to Rasuwa',
  'At Rasuwa',
  'Nyalam Deliver',
  'Kerung Deliver',
  'Tatopani Deliver',
  'Rasuwa Deliver',
] as const;

export type Status = typeof STATUS_OPTIONS[number];

export interface TransitData {
  containerNo: string;
  loadingDate: string; // Dispatch / Loading date
  dispatchDate?: string; // Synonym for loadingDate
  dispatchedTo?: string; // Next destination from this transit point
  loadedCtn?: number | null; // Cartons loaded at this transit point
}

export interface Consignment {
  id: string;
  origin: 'Guangzhou' | 'Yiwu';
  date: string;
  consignmentNo: string;
  lotNo?: string; // Lot Number
  container?: string; // Container assigned to the lot
  dispatchedDate?: string; // Dispatch date of the lot
  marka: string;
  totalCtn: number;
  loadedCtn?: number | null; // Cartons actually loaded from origin warehouse

  cbm: number;
  gw: number;
  destination: string;
  status: Status;
  clientName: string;
  remarks: string;
  transitPoints: Partial<Record<TransitPoint, TransitData>>;
  createdAt: number;
  updatedAt: number;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: 'General' | 'Customs' | 'Urgent' | 'Client' | 'Transit' | 'Warehouse';
  imageUrl?: string;
  audioTranscription?: string;
  audioDataUrl?: string;
  audioDuration?: number;
  isPinned?: boolean;
  colorTheme?: 'amber' | 'blue' | 'emerald' | 'rose' | 'indigo' | 'slate';
  linkedConsignmentNo?: string;
  linkedMarka?: string;
  createdAt: number;
  updatedAt: number;
}
