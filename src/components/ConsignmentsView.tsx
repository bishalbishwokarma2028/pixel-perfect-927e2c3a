import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { api } from '../api';
import { Consignment, Status } from '../types';
import { formatNumber } from '../lib/utils';
import { 
  Upload, Trash2, Edit, MapPin, 
  Search, X, FileSpreadsheet, Layers, RefreshCw, CheckSquare
} from 'lucide-react';
import ImportModal from './ImportModal';
import BulkEditModal from './BulkEditModal';
import EditConsignmentModal from './EditConsignmentModal';
import ExcelTable from './ExcelTable';

interface ConsignmentsViewProps {
  origin: 'Guangzhou' | 'Yiwu';
  clientFilter?: string | null;
  onClearClientFilter?: () => void;
}

export default function ConsignmentsView({ origin, clientFilter, onClearClientFilter }: ConsignmentsViewProps) {
  const [data, setData] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showImport, setShowImport] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [editingConsignment, setEditingConsignment] = useState<Consignment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [origin]);

  useRealtimeRefresh('consignments', () => fetchData());

  const fetchData = () => {
    setLoading(true);
    api.getConsignments()
      .then(res => {
        setData(res.filter(c => c.origin === origin));
        setLoading(false);
        setSelectedIds(new Set());
      })
      .catch(err => {
        console.error('Error fetching consignments:', err);
        setLoading(false);
      });
  };

  const handleImport = async (newItems: Partial<Consignment>[]) => {
    await api.addConsignments(newItems);
    setShowImport(false);
    fetchData();
  };

  const handleSingleSave = async (id: string, updates: Partial<Consignment>) => {
    await api.updateConsignment(id, updates);
    setData(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleBulkSave = async (updates: Partial<Consignment>) => {
    await api.bulkEdit(Array.from(selectedIds), updates);
    setShowBulkEdit(false);
    setSelectedIds(new Set());
    fetchData();
  };

  const handleBulkDelete = async (ids: string[]) => {
    await api.bulkDelete(ids);
    setData(prev => prev.filter(c => !ids.includes(c.id)));
    setSelectedIds(new Set());
  };

  const handleBulkStatusChange = async (ids: string[], status: Status) => {
    await api.bulkEdit(ids, { status });
    setData(prev => prev.map(c => ids.includes(c.id) ? { ...c, status } : c));
  };
  
  const handleDelete = async (id: string) => {
    await api.deleteConsignment(id);
    setData(prev => prev.filter(c => c.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filteredData = useMemo(() => {
    return data.filter(c => {
      if (clientFilter && c.clientName !== clientFilter) return false;
      return true;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [data, clientFilter]);

  // Volume metrics per Lot No.
  const lotTotals = useMemo(() => {
    const map = new Map<string, { lotNo: string; count: number; ctn: number; cbm: number; gw: number }>();
    filteredData.forEach(c => {
      const key = (c.lotNo?.trim() || 'UNASSIGNED').toUpperCase();
      const entry = map.get(key) || { lotNo: key, count: 0, ctn: 0, cbm: 0, gw: 0 };
      entry.count += 1;
      entry.ctn += c.totalCtn || 0;
      entry.cbm += c.cbm || 0;
      entry.gw += c.gw || 0;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.lotNo === 'UNASSIGNED') return 1;
      if (b.lotNo === 'UNASSIGNED') return -1;
      return a.lotNo.localeCompare(b.lotNo);
    });
  }, [filteredData]);

  return (
    <div className="space-y-3 w-full mx-auto animate-in fade-in duration-150">
      {/* Top Streamlined Header Bar - Compact to leave middle screen for data */}
      <div className="bg-white px-5 py-3 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
              <MapPin size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>{origin} Warehouse</span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  {filteredData.length} Shipments
                </span>
              </h2>
            </div>
          </div>

          {/* Per-Lot KPI Pill Strip */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 text-xs font-bold">
            {lotTotals.map(lt => (
              <div key={lt.lotNo} className="flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-xl border border-slate-200">
                <span className="text-teal-700">{lt.lotNo === 'UNASSIGNED' ? 'No Lot' : `Lot ${lt.lotNo}`}</span>
                <span className="text-blue-700 font-mono">{formatNumber(lt.ctn)} CTN</span>
                <span className="text-slate-400">•</span>
                <span className="text-indigo-700 font-mono">{formatNumber(lt.cbm)} CBM</span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 font-mono">{formatNumber(lt.gw)} KG</span>
              </div>
            ))}
          </div>

          {clientFilter && (
            <div className="inline-flex items-center space-x-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-lg text-xs font-bold border border-blue-200">
              <span>Client: <strong>{clientFilter}</strong></span>
              <button onClick={onClearClientFilter} className="hover:bg-blue-200 rounded p-0.5 transition-colors">
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Top Action Controls */}
        <div className="flex items-center space-x-2 self-end md:self-auto">
          {selectedIds.size > 0 && (
            <button 
              onClick={() => setShowBulkEdit(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            >
              <Layers size={14} />
              <span>Master Edit ({selectedIds.size})</span>
            </button>
          )}

          <button 
            onClick={() => setShowImport(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
            title="Import Excel or Google Sheets copy-paste"
          >
            <Upload size={14} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={fetchData}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-2xs"
            title="Refresh Consignments"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Excel Spreadsheet Grid Component (Starts in the upper-middle of the screen) */}
      <ExcelTable
        data={filteredData}
        title={`ADO International - ${origin} Warehouse Consignments`}
        subtitle={`Live stock and transit manifest for ${origin} warehouse`}
        filenamePrefix={`${origin}_Warehouse`}
        showLoadedCtn={true}
        loadedCtnLabel={`Loaded CTN from ${origin}`}
        onEdit={setEditingConsignment}
        onDelete={handleDelete}
        onInlineUpdate={handleSingleSave}
        showActions={true}
        selectedIds={selectedIds}
        onSelectChange={setSelectedIds}
        onBulkEdit={() => setShowBulkEdit(true)}
        onBulkDelete={handleBulkDelete}
        onBulkStatusChange={handleBulkStatusChange}
      />

      {/* Single Edit Modal */}
      {editingConsignment && (
        <EditConsignmentModal
          consignment={editingConsignment}
          onClose={() => setEditingConsignment(null)}
          onSave={handleSingleSave}
        />
      )}

      {/* Master Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkEdit(false)}
          onSave={handleBulkSave}
        />
      )}

      {/* Excel Import Modal */}
      {showImport && (
        <ImportModal 
          origin={origin} 
          onClose={() => setShowImport(false)} 
          onImport={handleImport} 
        />
      )}
    </div>
  );
}
