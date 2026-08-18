import React, { useState } from 'react';
import { Consignment, STATUS_OPTIONS, Status, TRANSIT_POINTS, TransitPoint } from '../types';
import { X, Save, Loader2, CheckSquare, Layers, Truck, FileText } from 'lucide-react';

interface BulkEditModalProps {
  selectedIds: string[];
  onClose: () => void;
  onSave: (updates: Partial<Consignment>) => Promise<void>;
}

export default function BulkEditModal({ selectedIds, onClose, onSave }: BulkEditModalProps) {
  const [status, setStatus] = useState<Status | ''>('');
  const [lotNo, setLotNo] = useState('');
  const [container, setContainer] = useState('');
  const [dispatchedDate, setDispatchedDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [marka, setMarka] = useState('');
  const [origin, setOrigin] = useState<'Guangzhou' | 'Yiwu' | ''>('');
  const [destination, setDestination] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Transit points sub-fields
  type TransitDraft = { containerNo: string; loadingDate: string; dispatchedTo: string; loadedCtn: string };
  const emptyDraft: TransitDraft = { containerNo: '', loadingDate: '', dispatchedTo: '', loadedCtn: '' };
  const [transitUpdates, setTransitUpdates] = useState<Partial<Record<TransitPoint, TransitDraft>>>({});
  
  const [loading, setLoading] = useState(false);

  const handleTransitChange = (tp: TransitPoint, field: keyof TransitDraft, value: string) => {
    setTransitUpdates(prev => ({
      ...prev,
      [tp]: {
        ...(prev[tp] || emptyDraft),
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const updates: Partial<Consignment> = {};
    if (status) updates.status = status;
    if (lotNo.trim()) updates.lotNo = lotNo.trim();
    if (container.trim()) updates.container = container.trim();
    if (dispatchedDate.trim()) updates.dispatchedDate = dispatchedDate.trim();
    if (clientName.trim()) updates.clientName = clientName.trim();
    if (marka.trim()) updates.marka = marka.trim();
    if (origin) updates.origin = origin as 'Guangzhou' | 'Yiwu';
    if (destination.trim()) updates.destination = destination.trim();
    if (remarks.trim()) updates.remarks = remarks.trim();

    // Filter transit updates to only non-empty fields
    const validTransit: any = {};
    for (const [tp, data] of Object.entries(transitUpdates)) {
      const tpEntry = data as Partial<TransitDraft> | undefined;
      if (!tpEntry) continue;
      const hasValue = tpEntry.containerNo?.trim() || tpEntry.loadingDate?.trim() || tpEntry.dispatchedTo?.trim() || tpEntry.loadedCtn?.trim();
      if (hasValue) {
        validTransit[tp] = {
          containerNo: tpEntry.containerNo?.trim() || '',
          loadingDate: tpEntry.loadingDate?.trim() || '',
          dispatchedTo: tpEntry.dispatchedTo?.trim() || '',
          loadedCtn: tpEntry.loadedCtn?.trim() ? Number(tpEntry.loadedCtn) : null
        };
      }
    }
    if (Object.keys(validTransit).length > 0) {
      updates.transitPoints = validTransit;
    }

    try {
      await onSave(updates);
      onClose();
    } catch (err) {
      console.error('Master edit failed:', err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-inner">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Master Bulk Edit</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Applying updates across <strong className="text-white">{selectedIds.length}</strong> selected consignment{selectedIds.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-800 font-medium">
            💡 <strong>Smart Bulk Update:</strong> Only fields where you select or type a value will be modified. All blank fields will keep each consignment's existing data intact.
          </div>

          {/* Section 1: Main Status & General Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <FileText size={14} className="text-blue-600" />
              <span>Status & Cargo Attributes</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Update Status</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white font-medium text-slate-800"
                >
                  <option value="">-- Keep Existing Status --</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Origin Warehouse</label>
                <select 
                  value={origin} 
                  onChange={e => setOrigin(e.target.value as 'Guangzhou' | 'Yiwu' | '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white font-medium text-slate-800"
                >
                  <option value="">-- Keep Existing Origin --</option>
                  <option value="Guangzhou">Guangzhou</option>
                  <option value="Yiwu">Yiwu</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-700">Lot Number</label>
                <input 
                  type="text" 
                  value={lotNo} 
                  onChange={e => setLotNo(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm bg-teal-50/30 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-700">Container</label>
                <input 
                  type="text" 
                  value={container} 
                  onChange={e => setContainer(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm bg-teal-50/30 font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-teal-700">Dispatched Date</label>
                <input 
                  type="date" 
                  value={dispatchedDate} 
                  onChange={e => setDispatchedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm bg-teal-50/30 font-medium text-teal-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-blue-700">Client Name</label>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-indigo-700">Marka</label>
                <input 
                  type="text" 
                  value={marka} 
                  onChange={e => setMarka(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Destination</label>
                <input 
                  type="text" 
                  value={destination} 
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Remarks / Append Notes</label>
                <input 
                  type="text" 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Transit Points */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Truck size={14} className="text-purple-600" />
              <span>Bulk Update Transit Points & Containers</span>
            </h3>
            
            <div className="space-y-3">
              {TRANSIT_POINTS.map(tp => (
                <div key={tp} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-800 text-xs tracking-wider uppercase flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                    <span>{tp}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Container No.</label>
                      <input 
                        type="text"
                        value={transitUpdates[tp]?.containerNo || ''}
                        onChange={e => handleTransitChange(tp, 'containerNo', e.target.value)}
                        placeholder="Leave blank to keep unchanged"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Loading Date</label>
                      <input 
                        type="date"
                        value={transitUpdates[tp]?.loadingDate || ''}
                        onChange={e => handleTransitChange(tp, 'loadingDate', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Dispatched To</label>
                      <input 
                        type="text"
                        value={transitUpdates[tp]?.dispatchedTo || ''}
                        onChange={e => handleTransitChange(tp, 'dispatchedTo', e.target.value)}
                        placeholder="Leave blank to keep unchanged"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Loaded CTN</label>
                      <input 
                        type="number"
                        min={0}
                        value={transitUpdates[tp]?.loadedCtn || ''}
                        onChange={e => handleTransitChange(tp, 'loadedCtn', e.target.value)}
                        placeholder="Leave blank to keep unchanged"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-sm transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm flex items-center space-x-2 disabled:opacity-50 shadow-sm"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>Apply Master Updates ({selectedIds.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
