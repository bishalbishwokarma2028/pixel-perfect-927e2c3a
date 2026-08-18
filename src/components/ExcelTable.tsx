import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Consignment, Status, STATUS_OPTIONS, TRANSIT_POINTS, TransitPoint } from '../types';
import { formatNumber } from '../lib/utils';
import { exportConsignmentsToExcel, exportClientLedgerToExcel } from '../lib/excelExport';
import {
  Download, Search, Filter, FileSpreadsheet,
  ArrowUp, ArrowDown, ChevronRight,
  Eye, Edit, Trash2,
  Maximize2, Minimize2, Layers,
  CheckSquare, X,
  MoveHorizontal, ChevronLeft
} from 'lucide-react';
import ConsignmentDetailModal from './ConsignmentDetailModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface ExcelTableProps {
  data: Consignment[];
  title?: string;
  subtitle?: string;
  filenamePrefix?: string;
  clientName?: string;
  isClientView?: boolean;
  showLoadedCtn?: boolean;
  loadedCtnLabel?: string;
  onView?: (consignment: Consignment) => void;
  onEdit?: (consignment: Consignment) => void;
  onDelete?: (id: string) => void;
  onInlineUpdate?: (id: string, updates: Partial<Consignment>) => Promise<void> | void;
  showActions?: boolean;

  // Selection Props
  selectedIds?: Set<string>;
  onSelectChange?: (selectedIds: Set<string>) => void;
  onBulkEdit?: (selectedIds: string[]) => void;
  onBulkDelete?: (selectedIds: string[]) => Promise<void> | void;
  onBulkStatusChange?: (selectedIds: string[], status: Status) => Promise<void> | void;
}

const HUB_META: { key: TransitPoint; label: string; accent: string; tint: string }[] = [
  { key: 'LHASA', label: 'Lhasa', accent: 'text-sky-300', tint: 'bg-sky-50/20' },
  { key: 'NYLAM', label: 'Nyalam', accent: 'text-sky-300', tint: 'bg-sky-50/20' },
  { key: 'KERUNG', label: 'Kerung', accent: 'text-emerald-300', tint: 'bg-emerald-50/30' },
  { key: 'TATOPANI', label: 'Tatopani', accent: 'text-indigo-300', tint: 'bg-indigo-50/30' },
  { key: 'RASUWA', label: 'Rasuwa', accent: 'text-cyan-300', tint: 'bg-cyan-50/20' },
];

export default function ExcelTable({
  data,
  title,
  filenamePrefix = 'Consignments',
  clientName,
  isClientView = false,
  showLoadedCtn = false,
  loadedCtnLabel = 'Loaded CTN',
  onView,
  onEdit,
  onDelete,
  onInlineUpdate,
  showActions = false,
  selectedIds: externalSelectedIds,
  onSelectChange,
  onBulkEdit,
  onBulkDelete,
  onBulkStatusChange
}: ExcelTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  // No default sorting — rows stay in their original import order until the user sorts.
  const [sortField, setSortField] = useState<keyof Consignment | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [viewingDetail, setViewingDetail] = useState<Consignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; consignment?: Consignment; isBulk?: boolean } | null>(null);

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set<string>());
  const [selectionActive, setSelectionActive] = useState(false);

  const selectedIds: Set<string> = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;

  const updateSelectedIds = (next: Set<string>) => {
    if (onSelectChange) {
      onSelectChange(next);
    } else {
      setInternalSelectedIds(next);
    }
  };

  const [expandedHubs, setExpandedHubs] = useState<Record<TransitPoint, boolean>>({
    LHASA: false,
    NYLAM: false,
    KERUNG: true,
    TATOPANI: true,
    RASUWA: false
  });

  const toggleHub = (hub: TransitPoint) => {
    setExpandedHubs(prev => ({ ...prev, [hub]: !prev[hub] }));
  };

  const toggleAllHubs = (expand: boolean) => {
    setExpandedHubs({ LHASA: expand, NYLAM: expand, KERUNG: expand, TATOPANI: expand, RASUWA: expand });
  };

  // Horizontal Scroll & Slide Bar Synchronization Logic
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [canScrollHorizontally, setCanScrollHorizontally] = useState(false);

  const updateScrollMetrics = useCallback(() => {
    if (tableScrollRef.current) {
      const { scrollLeft: sLeft, scrollWidth: sWidth, clientWidth: cWidth } = tableScrollRef.current;
      const max = Math.max(0, sWidth - cWidth);
      setScrollLeft(sLeft);
      setMaxScroll(max);
      setCanScrollHorizontally(max > 5);
    }
  }, []);

  const slideHorizontal = (delta: number) => {
    tableScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollPercent = maxScroll > 0 ? Math.round((scrollLeft / maxScroll) * 100) : 0;

  // Filter & Search
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch =
        !searchTerm.trim() ||
        (item.consignmentNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.lotNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.marka || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.destination || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.remarks || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  // Sort only when the user explicitly picks a column
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortField, sortDirection]);

  const totals = useMemo(() => {
    return sortedData.reduce(
      (acc, curr) => {
        acc.ctn += curr.totalCtn || 0;
        acc.cbm += curr.cbm || 0;
        acc.gw += curr.gw || 0;
        return acc;
      },
      { ctn: 0, cbm: 0, gw: 0 }
    );
  }, [sortedData]);

  // Group rows by Lot No. in display order so each lot's subtotal sits right below its rows.
  const lotGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Consignment[]>();
    sortedData.forEach(c => {
      const key = (c.lotNo?.trim() || 'UNASSIGNED').toUpperCase();
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(c);
    });
    return order.map(key => {
      const rows = map.get(key)!;
      const sub = rows.reduce(
        (acc, c) => ({
          ctn: acc.ctn + (c.totalCtn || 0),
          cbm: acc.cbm + (c.cbm || 0),
          gw: acc.gw + (c.gw || 0),
          loaded: acc.loaded + (c.loadedCtn ?? c.totalCtn ?? 0),
        }),
        { ctn: 0, cbm: 0, gw: 0, loaded: 0 }
      );
      return { lotNo: key, rows, ...sub };
    });
  }, [sortedData]);

  useEffect(() => {
    const container = tableScrollRef.current;
    if (!container) return;

    updateScrollMetrics();
    const handleScroll = () => updateScrollMetrics();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);
    const observer = new ResizeObserver(() => updateScrollMetrics());
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollMetrics);
      observer.disconnect();
    };
  }, [updateScrollMetrics, sortedData.length, expandedHubs]);

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedData.length && sortedData.length > 0) {
      updateSelectedIds(new Set<string>());
    } else {
      updateSelectedIds(new Set<string>(sortedData.map(c => c.id)));
    }
  };

  const clearSelection = () => updateSelectedIds(new Set<string>());

  const handleSort = (field: keyof Consignment) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // third click returns to the original (import) order
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortIcon = (field: keyof Consignment) =>
    sortField === field ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null;

  const handleStatusChange = (id: string, newStatus: Status) => {
    onInlineUpdate?.(id, { status: newStatus });
  };

  const handleTransitInlineChange = (
    id: string,
    currentTransitPoints: Consignment['transitPoints'],
    tp: TransitPoint,
    field: 'containerNo' | 'dispatchDate' | 'loadingDate' | 'dispatchedTo' | 'loadedCtn',
    value: string | number
  ) => {
    if (!onInlineUpdate) return;
    const existing = currentTransitPoints?.[tp] || { containerNo: '', loadingDate: '' };
    const updatedTpData: any = {
      ...existing,
      [field]: value,
      ...(field === 'dispatchDate' ? { loadingDate: value } : {}),
      ...(field === 'loadingDate' ? { dispatchDate: value } : {})
    };

    onInlineUpdate(id, {
      transitPoints: { ...currentTransitPoints, [tp]: updatedTpData }
    });
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Deliver')) return 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500';
    if (status.includes('Pending in Guangzhou')) return 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500';
    if (status.includes('Pending in Yiwu')) return 'bg-orange-50 text-orange-800 border-orange-300 focus:ring-orange-500';
    if (status.includes('On the way')) return 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-500';
    if (status.includes('At ')) return 'bg-purple-50 text-purple-800 border-purple-300 focus:ring-purple-500';
    return 'bg-slate-50 text-slate-800 border-slate-300 focus:ring-slate-500';
  };

  const handleExportSelected = () => {
    const selectedData = sortedData.filter(c => selectedIds.has(c.id));
    if (selectedData.length === 0) return;
    const filename = `${filenamePrefix}_Selected_${selectedData.length}_Items_${new Date().toISOString().split('T')[0]}`;
    if (isClientView || clientName) {
      exportClientLedgerToExcel(clientName || title || 'Client', selectedData, filename);
    } else {
      exportConsignmentsToExcel(selectedData, filename, `${title || 'Consignment Excel Report'} (Selected: ${selectedData.length})`, { showLoadedCtn, loadedCtnLabel });
    }
  };

  const handleBatchStatusApply = async (status: Status) => {
    if (selectedIds.size === 0) return;
    if (onBulkStatusChange) {
      await onBulkStatusChange(Array.from(selectedIds), status);
    } else if (onInlineUpdate) {
      for (const id of Array.from(selectedIds)) {
        await onInlineUpdate(id, { status });
      }
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ isBulk: true });
  };

  const executeDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.isBulk) {
      if (onBulkDelete) {
        await onBulkDelete(Array.from(selectedIds));
        clearSelection();
      } else if (onDelete) {
        for (const id of Array.from(selectedIds)) {
          await onDelete(id);
        }
        clearSelection();
      }
    } else if (deleteTarget.id && onDelete) {
      await onDelete(deleteTarget.id);
      if (selectedIds.has(deleteTarget.id)) {
        const next = new Set(selectedIds);
        next.delete(deleteTarget.id);
        updateSelectedIds(next);
      }
    }
    setDeleteTarget(null);
  };

  const allHubsExpanded = Object.values(expandedHubs).every(Boolean);
  const isAllSelected = sortedData.length > 0 && selectedIds.size === sortedData.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < sortedData.length;

  // Column bookkeeping (checkbox, Date, Consignment No, Marka, CTN, CBM, GW, Destination, Status, Client, Lot, Container, Dispatched Date [, Loaded CTN])
  const leadingCols = 13 + (showLoadedCtn ? 1 : 0);
  const transitCols = HUB_META.reduce((n, h) => n + (expandedHubs[h.key] ? 4 : 1), 0);
  const trailingCols = 1; // remarks
  const totalCols = leadingCols + transitCols + trailingCols + (showActions ? 1 : 0);
  // subtotal row: label spans checkbox+Date+Consignment+Marka = 4, then CTN/CBM/GW, then the rest
  const subtotalTailSpan = totalCols - 4 - 3 - (showActions ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Top Streamlined Control Bar */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search No, Lot, Client, Marka, Dest..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter size={13} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses ({data.length})</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            {sortedData.length} records
          </span>

          {sortField ? (
            <button
              onClick={() => setSortField(null)}
              className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
              title="Return rows to their original import order"
            >
              Sorted by {String(sortField)} — Reset to import order
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              Import order
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectionActive(!selectionActive);
              if (selectionActive && selectedIds.size > 0) clearSelection();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center space-x-1.5 shadow-2xs ${
              selectionActive || selectedIds.size > 0
                ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/40'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Toggle multi-select mode"
          >
            <CheckSquare size={14} />
            <span>{selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Select Rows'}</span>
          </button>

          <button
            onClick={() => toggleAllHubs(!allHubsExpanded)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 flex items-center space-x-1.5 shadow-2xs"
            title="Expand or collapse the transit hub detail columns"
          >
            {allHubsExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{allHubsExpanded ? 'Collapse Hubs' : 'Expand 5 Hubs'}</span>
          </button>

          <button
            onClick={handleExportSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all border border-emerald-900"
            title={selectedIds.size === 0 ? 'Select the rows you want to export first' : `Export ${selectedIds.size} selected consignment(s)`}
          >
            <FileSpreadsheet size={14} />
            <span>{selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export Selected'}</span>
          </button>
        </div>
      </div>

      {/* BULK ACTION RIBBON */}
      {(selectionActive || selectedIds.size > 0) && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-2.5 rounded-xl border border-blue-700 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-black bg-blue-500 text-white px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-inner">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={toggleSelectAll}
              className="text-xs font-bold text-blue-200 hover:text-white underline decoration-blue-400 underline-offset-2 transition-colors"
            >
              {isAllSelected ? 'Deselect All' : `Select All (${sortedData.length})`}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onBulkEdit && (
              <button
                onClick={() => onBulkEdit(Array.from(selectedIds))}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Layers size={13} />
                <span>Master Bulk Edit</span>
              </button>
            )}

            <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-300 font-semibold">Set Status:</span>
              <select
                disabled={selectedIds.size === 0}
                onChange={e => {
                  if (e.target.value) {
                    handleBatchStatusApply(e.target.value as Status);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="bg-slate-900 text-white text-xs font-bold rounded px-2 py-1 border border-slate-600 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="" disabled>Change Status...</option>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt} className="bg-slate-900 text-white font-medium">{opt}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportSelected}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Download size={13} />
              <span>Export ({selectedIds.size})</span>
            </button>

            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>

            <button
              onClick={clearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Cancel Selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="bg-white border-2 border-slate-400 rounded-xl shadow-md overflow-hidden flex flex-col relative">
        <div className="bg-slate-900 text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span className="font-bold uppercase tracking-wider text-slate-200 text-[11px]">
              EXCEL SPREADSHEET LEDGER — CHINA-NEPAL CARGO
            </span>
          </div>

          {canScrollHorizontally && (
            <div className="flex items-center space-x-1.5 bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-inner">
              <span className="text-[10px] text-slate-400 font-sans hidden sm:flex items-center space-x-1">
                <MoveHorizontal size={12} className="text-blue-400 inline mr-0.5" />
                <span>Slide:</span>
              </span>
              <button
                type="button"
                onClick={() => slideHorizontal(-350)}
                disabled={scrollLeft <= 5}
                className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 disabled:opacity-30 text-white rounded text-[10px] font-bold flex items-center space-x-0.5 transition-colors"
              >
                <ChevronLeft size={12} />
                <span className="hidden md:inline">Left</span>
              </button>
              <span className="text-[10px] font-mono text-blue-300 font-bold px-1 min-w-[36px] text-center">{scrollPercent}%</span>
              <button
                type="button"
                onClick={() => slideHorizontal(350)}
                disabled={scrollLeft >= maxScroll - 5}
                className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 disabled:opacity-30 text-white rounded text-[10px] font-bold flex items-center space-x-0.5 transition-colors"
              >
                <span className="hidden md:inline">Right</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          <div className="text-slate-300 flex flex-wrap items-center gap-1.5 text-[11px] justify-end">
            {lotGroups.map(lt => (
              <span key={lt.lotNo} className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                <strong className="text-teal-300">{lt.lotNo === 'UNASSIGNED' ? 'No Lot' : `Lot ${lt.lotNo}`}</strong>
                {': '}
                <span className="text-emerald-300 font-bold">{formatNumber(lt.ctn)} CTN</span>
                {' • '}
                <span className="text-indigo-300 font-bold">{formatNumber(lt.cbm)} CBM</span>
                {' • '}
                <span className="text-amber-300 font-bold">{formatNumber(lt.gw)} KG</span>
              </span>
            ))}
          </div>
        </div>

        <div
          ref={tableScrollRef}
          className="overflow-auto custom-scrollbar max-h-[calc(100vh-270px)] min-h-[320px] scroll-smooth overscroll-contain"
        >
          <table className="w-full text-center border-collapse border border-slate-300 font-sans text-xs select-text">
            <thead className="sticky top-0 bg-slate-900 text-white z-20 shadow-md">
              <tr>
                <th rowSpan={2} className="border border-slate-600 p-2 w-10 text-center bg-slate-950">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-500 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    title="Select / Deselect all rows"
                  />
                </th>

                <th rowSpan={2} onClick={() => handleSort('date')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>Date</span>{sortIcon('date')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('consignmentNo')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>Consignment No.</span>{sortIcon('consignmentNo')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('marka')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-indigo-900 text-center whitespace-nowrap bg-indigo-950 text-indigo-100">
                  <div className="flex items-center justify-center space-x-1"><span>Marka</span>{sortIcon('marka')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('totalCtn')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>Total CTN</span>{sortIcon('totalCtn')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('cbm')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>CBM</span>{sortIcon('cbm')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('gw')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>GW (KG)</span>{sortIcon('gw')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('destination')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-800 text-center whitespace-nowrap bg-slate-900">
                  <div className="flex items-center justify-center space-x-1"><span>Destination</span>{sortIcon('destination')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('status')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-amber-900 text-center whitespace-nowrap bg-amber-950 text-amber-200 min-w-[180px]">
                  <div className="flex items-center justify-center space-x-1"><span>Status</span>{sortIcon('status')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('clientName')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-blue-900 text-center whitespace-nowrap bg-blue-950 text-blue-100">
                  <div className="flex items-center justify-center space-x-1"><span>Client Name</span>{sortIcon('clientName')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('lotNo')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-teal-900 text-center whitespace-nowrap bg-teal-950 text-teal-200">
                  <div className="flex items-center justify-center space-x-1"><span>Lot No.</span>{sortIcon('lotNo')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('container')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-teal-900 text-center whitespace-nowrap bg-teal-950 text-teal-200">
                  <div className="flex items-center justify-center space-x-1"><span>Container</span>{sortIcon('container')}</div>
                </th>

                <th rowSpan={2} onClick={() => handleSort('dispatchedDate')} className="border border-slate-600 p-2 font-bold uppercase tracking-wider cursor-pointer hover:bg-teal-900 text-center whitespace-nowrap bg-teal-950 text-teal-200">
                  <div className="flex items-center justify-center space-x-1"><span>Dispatched Date</span>{sortIcon('dispatchedDate')}</div>
                </th>

                {showLoadedCtn && (
                  <th rowSpan={2} className="border border-slate-600 p-2 font-bold uppercase tracking-wider text-center whitespace-nowrap bg-emerald-950 text-emerald-200">
                    {loadedCtnLabel}
                  </th>
                )}

                {HUB_META.map(hub => (
                  <th
                    key={hub.key}
                    colSpan={expandedHubs[hub.key] ? 4 : 1}
                    className={`border border-slate-600 p-1.5 font-bold uppercase tracking-wider text-center bg-slate-950 ${hub.accent}`}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>{hub.label}</span>
                      <button
                        type="button"
                        onClick={() => toggleHub(hub.key)}
                        className="px-1 py-0.5 bg-slate-800 hover:bg-sky-600 text-white rounded text-[9px] transition-colors"
                        title={expandedHubs[hub.key] ? 'Collapse' : 'Expand hub details'}
                      >
                        {expandedHubs[hub.key] ? '−' : '+'}
                      </button>
                    </div>
                  </th>
                ))}

                <th rowSpan={2} className="border border-slate-600 p-2 font-bold uppercase tracking-wider text-center min-w-[130px] bg-slate-900">
                  Remarks
                </th>

                {showActions && (
                  <th rowSpan={2} className="sticky right-0 border-l-2 border-slate-600 border-r border-y border-slate-600 p-2 font-bold uppercase tracking-wider text-center w-28 bg-slate-950 text-white z-30 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)]">
                    Actions
                  </th>
                )}
              </tr>

              <tr>
                {HUB_META.map(hub => (
                  expandedHubs[hub.key] ? (
                    <React.Fragment key={hub.key}>
                      <th className="border border-slate-600 p-1 text-[10px] font-bold uppercase bg-slate-900 text-slate-300 whitespace-nowrap min-w-[105px]">Container No.</th>
                      <th className="border border-slate-600 p-1 text-[10px] font-bold uppercase bg-slate-900 text-slate-300 whitespace-nowrap min-w-[105px]">Dispatch Date</th>
                      <th className="border border-slate-600 p-1 text-[10px] font-bold uppercase bg-slate-900 text-slate-300 whitespace-nowrap min-w-[110px]">Dispatched To</th>
                      <th className="border border-slate-600 p-1 text-[10px] font-bold uppercase bg-slate-900 text-slate-300 whitespace-nowrap min-w-[90px]">Loaded CTN</th>
                    </React.Fragment>
                  ) : (
                    <th key={hub.key} className="border border-slate-600 p-1 text-[9px] font-bold text-slate-400 bg-slate-900">Summary</th>
                  )
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="p-12 text-center text-slate-500 font-medium bg-slate-50">
                    No consignments match your search or filter.
                  </td>
                </tr>
              ) : (
                lotGroups.map(group => (
                  <React.Fragment key={`grp-${group.lotNo}`}>
                    {group.rows.map((row, index) => {
                      const isEven = index % 2 === 0;
                      const isSelected = selectedIds.has(row.id);
                      const loadedValue = row.loadedCtn ?? row.totalCtn ?? 0;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-blue-50/90 transition-colors ${
                            isSelected ? 'bg-blue-100/90 font-medium' : isEven ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className={`border border-slate-300 p-2 text-center ${isSelected ? 'bg-blue-200/60' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="w-4 h-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                            />
                          </td>

                          <td className="border border-slate-300 p-2 text-slate-700 font-medium whitespace-nowrap text-center">
                            {row.date || '-'}
                          </td>

                          <td className="border border-slate-300 p-2 font-mono font-black text-slate-900 whitespace-nowrap text-center bg-amber-50/40">
                            {row.consignmentNo}
                          </td>

                          <td className="border border-slate-300 p-2 font-bold text-indigo-700 whitespace-nowrap text-center bg-indigo-50/30 font-mono">
                            {row.marka || '-'}
                          </td>

                          <td className="border border-slate-300 p-2 font-bold text-slate-800 text-center whitespace-nowrap">
                            {formatNumber(row.totalCtn)}
                          </td>

                          <td className="border border-slate-300 p-2 font-bold text-slate-800 text-center whitespace-nowrap">
                            {formatNumber(row.cbm)}
                          </td>

                          <td className="border border-slate-300 p-2 text-slate-700 text-center whitespace-nowrap">
                            {formatNumber(row.gw)}
                          </td>

                          <td className="border border-slate-300 p-2 text-slate-700 text-center whitespace-nowrap">
                            {row.destination}
                          </td>

                          <td className="border border-slate-300 p-1 text-center whitespace-nowrap bg-amber-50/20">
                            <select
                              value={row.status}
                              onChange={e => handleStatusChange(row.id, e.target.value as Status)}
                              className={`w-full text-xs font-extrabold px-2 py-1.5 rounded-lg border shadow-2xs cursor-pointer transition-all focus:outline-none focus:ring-2 ${getStatusColor(row.status)}`}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt} className="bg-white text-slate-900 font-semibold text-xs">{opt}</option>
                              ))}
                            </select>
                          </td>

                          <td className="border border-slate-300 p-2 font-bold text-blue-700 whitespace-nowrap text-center bg-blue-50/40">
                            {row.clientName}
                          </td>

                          {/* LOT NUMBER (Editable) */}
                          <td className="border border-slate-300 p-1 text-center whitespace-nowrap bg-teal-50/40">
                            {onInlineUpdate ? (
                              <input
                                type="text"
                                defaultValue={row.lotNo || ''}
                                onBlur={e => {
                                  if (e.target.value !== (row.lotNo || '')) onInlineUpdate(row.id, { lotNo: e.target.value });
                                }}
                                placeholder="Lot #"
                                className="w-20 text-center font-mono font-bold text-teal-800 text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-teal-300 focus:border-teal-500 rounded transition-all"
                              />
                            ) : (
                              <span className="font-mono font-bold text-teal-800 text-xs px-1.5 py-0.5 rounded bg-teal-100/50">{row.lotNo || '-'}</span>
                            )}
                          </td>

                          {/* CONTAINER (Editable) */}
                          <td className="border border-slate-300 p-1 text-center whitespace-nowrap bg-teal-50/25">
                            {onInlineUpdate ? (
                              <input
                                type="text"
                                defaultValue={row.container || ''}
                                onBlur={e => {
                                  if (e.target.value !== (row.container || '')) onInlineUpdate(row.id, { container: e.target.value });
                                }}
                                placeholder="Container #"
                                className="w-24 text-center font-mono font-bold text-teal-800 text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-teal-300 focus:border-teal-500 rounded transition-all"
                              />
                            ) : (
                              <span className="font-mono font-bold text-teal-800 text-xs">{row.container || '-'}</span>
                            )}
                          </td>

                          {/* DISPATCHED DATE (Editable) */}
                          <td className="border border-slate-300 p-1 text-center whitespace-nowrap bg-teal-50/25">
                            {onInlineUpdate ? (
                              <input
                                type="date"
                                defaultValue={row.dispatchedDate || ''}
                                onChange={e => onInlineUpdate(row.id, { dispatchedDate: e.target.value })}
                                className="text-center text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-teal-300 focus:border-teal-500 rounded transition-all text-teal-900 font-medium"
                              />
                            ) : (
                              <span className="text-xs text-teal-900 font-medium">{row.dispatchedDate || '-'}</span>
                            )}
                          </td>

                          {/* LOADED CTN FROM GUANGZHOU (defaults to Total CTN, editable & sticky once set) */}
                          {showLoadedCtn && (
                            <td className="border border-slate-300 p-1 text-center whitespace-nowrap bg-emerald-50/40">
                              {onInlineUpdate ? (
                                <input
                                  key={`loaded-${row.id}-${row.loadedCtn ?? 'auto'}`}
                                  type="number"
                                  step="any"
                                  defaultValue={loadedValue}
                                  onBlur={e => {
                                    const raw = e.target.value.trim();
                                    const next = raw === '' ? null : Number(raw);
                                    if (next !== (row.loadedCtn ?? null)) {
                                      onInlineUpdate(row.id, { loadedCtn: next });
                                    }
                                  }}
                                  className="w-20 text-center font-bold text-emerald-800 text-xs py-1 px-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-500 rounded transition-all"
                                  title={row.loadedCtn === null || row.loadedCtn === undefined ? 'Auto-filled from Total CTN — edit to override' : 'Manually set'}
                                />
                              ) : (
                                <span className="font-bold text-emerald-800 text-xs">{formatNumber(loadedValue)}</span>
                              )}
                            </td>
                          )}

                          {/* TRANSIT HUBS */}
                          {HUB_META.map(hub => {
                            const tpData: any = row.transitPoints?.[hub.key] || {};
                            if (!expandedHubs[hub.key]) {
                              return (
                                <td key={hub.key} className="border border-slate-300 p-1.5 text-center whitespace-nowrap text-xs">
                                  {tpData.containerNo ? (
                                    <span
                                      className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200"
                                      title={`Dispatched: ${tpData.dispatchDate || tpData.loadingDate || 'N/A'}${tpData.dispatchedTo ? ` → ${tpData.dispatchedTo}` : ''}${tpData.loadedCtn ? ` • ${tpData.loadedCtn} CTN` : ''}`}
                                    >
                                      {tpData.containerNo}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </td>
                              );
                            }
                            return (
                              <React.Fragment key={hub.key}>
                                <td className={`border border-slate-300 p-1 text-center whitespace-nowrap ${hub.tint}`}>
                                  <input
                                    type="text"
                                    defaultValue={tpData.containerNo || ''}
                                    onBlur={e => handleTransitInlineChange(row.id, row.transitPoints, hub.key, 'containerNo', e.target.value)}
                                    placeholder="Container #"
                                    className="w-24 text-center font-mono text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                                  />
                                </td>
                                <td className={`border border-slate-300 p-1 text-center whitespace-nowrap ${hub.tint}`}>
                                  <input
                                    type="date"
                                    defaultValue={tpData.dispatchDate || tpData.loadingDate || ''}
                                    onChange={e => handleTransitInlineChange(row.id, row.transitPoints, hub.key, 'dispatchDate', e.target.value)}
                                    className="text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                                  />
                                </td>
                                <td className={`border border-slate-300 p-1 text-center whitespace-nowrap ${hub.tint}`}>
                                  <input
                                    type="text"
                                    defaultValue={tpData.dispatchedTo || ''}
                                    onBlur={e => handleTransitInlineChange(row.id, row.transitPoints, hub.key, 'dispatchedTo', e.target.value)}
                                    placeholder="Dispatched to"
                                    className="w-28 text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                                  />
                                </td>
                                <td className={`border border-slate-300 p-1 text-center whitespace-nowrap ${hub.tint}`}>
                                  <input
                                    type="number"
                                    step="any"
                                    defaultValue={tpData.loadedCtn ?? ''}
                                    onBlur={e => {
                                      const raw = e.target.value.trim();
                                      handleTransitInlineChange(row.id, row.transitPoints, hub.key, 'loadedCtn', raw === '' ? '' : Number(raw));
                                    }}
                                    placeholder="CTN"
                                    className="w-16 text-center text-xs font-bold p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white"
                                  />
                                </td>
                              </React.Fragment>
                            );
                          })}

                          <td className="border border-slate-300 p-2 text-slate-600 text-center max-w-[180px] truncate" title={row.remarks || ''}>
                            {row.remarks || '-'}
                          </td>

                          {showActions && (
                            <td className={`sticky right-0 border-l-2 border-slate-300 border-r border-y border-slate-300 p-2 text-center whitespace-nowrap z-20 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.12)] ${
                              isSelected ? 'bg-blue-100' : isEven ? 'bg-white' : 'bg-slate-50'
                            }`}>
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  onClick={() => { setViewingDetail(row); onView?.(row); }}
                                  className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded-md border border-indigo-300 transition-colors bg-white shadow-2xs"
                                  title="View full consignment details"
                                >
                                  <Eye size={14} />
                                </button>

                                {onEdit && (
                                  <button
                                    onClick={() => onEdit(row)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md border border-blue-300 transition-colors bg-white shadow-2xs"
                                    title="Edit Consignment Details"
                                  >
                                    <Edit size={14} />
                                  </button>
                                )}

                                {onDelete && (
                                  <button
                                    onClick={() => setDeleteTarget({ id: row.id, consignment: row })}
                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-md border border-red-300 transition-colors bg-white shadow-2xs"
                                    title="Delete Consignment Record"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* LOT SUBTOTAL ROW — sits directly below the last consignment of this lot */}
                    <tr className="bg-teal-50">
                      <td colSpan={4} className="border border-slate-400 p-1.5 text-center uppercase tracking-wider text-[11px] bg-teal-100 font-black text-teal-900">
                        {group.lotNo === 'UNASSIGNED' ? 'UNASSIGNED LOT' : `LOT ${group.lotNo}`} TOTAL ({group.rows.length} CONSIGNMENTS)
                      </td>
                      <td className="border border-slate-400 p-1.5 text-center text-teal-900 font-black text-[11px]">{formatNumber(group.ctn)} CTN</td>
                      <td className="border border-slate-400 p-1.5 text-center text-teal-900 font-black text-[11px]">{formatNumber(group.cbm)} CBM</td>
                      <td className="border border-slate-400 p-1.5 text-center text-teal-900 font-black text-[11px]">{formatNumber(group.gw)} KG</td>
                      <td colSpan={subtotalTailSpan} className="border border-slate-400 p-1.5 text-center text-slate-500 text-[11px] font-semibold">
                        Lot-wise subtotal{showLoadedCtn ? ` • Loaded: ${formatNumber(group.loaded)} CTN` : ''}
                      </td>
                      {showActions && (
                        <td className="sticky right-0 border-l-2 border-slate-400 border-r border-y border-slate-400 p-1.5 text-center bg-teal-50 z-20 text-slate-400 text-[11px]">—</td>
                      )}
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>

            <tfoot className="sticky bottom-0 bg-slate-200 border-t-2 border-slate-500 font-bold text-slate-900 shadow-lg z-10">
              <tr>
                <td colSpan={4} className="border border-slate-400 p-2 text-center uppercase tracking-wider text-xs bg-slate-300 font-black">
                  GRAND TOTAL ({sortedData.length} CONSIGNMENTS)
                </td>
                <td className="border border-slate-400 p-2 text-center text-blue-900 bg-blue-100/80 font-black text-xs">{formatNumber(totals.ctn)} CTN</td>
                <td className="border border-slate-400 p-2 text-center text-blue-900 bg-blue-100/80 font-black text-xs">{formatNumber(totals.cbm)} CBM</td>
                <td className="border border-slate-400 p-2 text-center text-blue-900 bg-blue-100/80 font-black text-xs">{formatNumber(totals.gw)} KG</td>
                <td colSpan={subtotalTailSpan} className="border border-slate-400 p-2 text-center text-slate-600 bg-slate-200 text-xs font-semibold">
                  ADO International Transport Nepal • Cross-Border Cargo Management
                </td>
                {showActions && (
                  <td className="sticky right-0 border-l-2 border-slate-400 border-r border-y border-slate-400 p-2 text-center whitespace-nowrap bg-slate-200 z-20 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.15)] text-slate-500 font-bold text-xs">
                    —
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Rich Consignment Detail View */}
      <ConsignmentDetailModal
        consignment={viewingDetail}
        onClose={() => setViewingDetail(null)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title="Are you sure you want to delete it?"
        message={
          deleteTarget?.isBulk
            ? `All ${selectedIds.size} selected consignments will be permanently removed from the ledger.`
            : `This consignment record will be permanently deleted from the warehouse ledger.`
        }
        itemLabel={
          deleteTarget?.isBulk
            ? `${selectedIds.size} Selected Consignments`
            : deleteTarget?.consignment
            ? `Consignment #${deleteTarget.consignment.consignmentNo} • Marka: ${deleteTarget.consignment.marka}`
            : undefined
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={executeDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
