import React, { useState, useEffect } from 'react';
import { Consignment, Status, STATUS_OPTIONS, TRANSIT_POINTS, TransitPoint, TransitData } from '../types';
import { X, Save, Loader2, Package, MapPin, Truck, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface EditConsignmentModalProps {
  consignment: Consignment;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Consignment>) => Promise<void>;
}

export default function EditConsignmentModal({ consignment, onClose, onSave }: EditConsignmentModalProps) {
  const [formData, setFormData] = useState<Consignment>({ ...consignment });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'transit'>('details');

  useEffect(() => {
    setFormData({ ...consignment });
  }, [consignment]);

  const handleChange = (field: keyof Consignment, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTransitChange = (tp: TransitPoint, field: keyof TransitData, value: string | number | null) => {
    setFormData(prev => {
      const currentTpData = prev.transitPoints?.[tp] || { containerNo: '', loadingDate: '' };
      return {
        ...prev,
        transitPoints: {
          ...prev.transitPoints,
          [tp]: {
            ...currentTpData,
            [field]: value
          }
        }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(consignment.id, formData);
      onClose();
    } catch (err) {
      console.error('Failed to update consignment:', err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Edit Consignment</h2>
                <span className="font-mono bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded text-xs border border-blue-800 font-bold">
                  {consignment.consignmentNo}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Update shipment record, metrics, or transit container schedules</p>
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

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex space-x-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText size={16} />
            <span>General Cargo Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transit')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'transit'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck size={16} />
            <span>Transit & Containers ({TRANSIT_POINTS.length} Points)</span>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Row 1: Identification */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                  <Calendar size={14} className="text-blue-600" />
                  <span>Consignment Identification</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.date || ''}
                      onChange={e => handleChange('date', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Consignment No.</label>
                    <input
                      type="text"
                      value={formData.consignmentNo || ''}
                      onChange={e => handleChange('consignmentNo', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-700 mb-1">Lot Number</label>
                    <input
                      type="text"
                      value={formData.lotNo || ''}
                      onChange={e => handleChange('lotNo', e.target.value)}
                      placeholder="e.g. LOT-402"
                      className="w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded-lg text-sm font-mono font-bold text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">Client Name</label>
                    <input
                      type="text"
                      value={formData.clientName || ''}
                      onChange={e => handleChange('clientName', e.target.value)}
                      placeholder="e.g. ABC Trade House"
                      className="w-full px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-lg text-sm font-bold text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Marka</label>
                    <input
                      type="text"
                      value={formData.marka || ''}
                      onChange={e => handleChange('marka', e.target.value)}
                      placeholder="e.g. KTM-900"
                      className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-300 rounded-lg text-sm font-bold text-indigo-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-700 mb-1">Container</label>
                    <input
                      type="text"
                      value={formData.container || ''}
                      onChange={e => handleChange('container', e.target.value)}
                      placeholder="e.g. TCLU-1234567"
                      className="w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded-lg text-sm font-mono font-bold text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-700 mb-1">Dispatched Date</label>
                    <input
                      type="date"
                      value={formData.dispatchedDate || ''}
                      onChange={e => handleChange('dispatchedDate', e.target.value)}
                      className="w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded-lg text-sm font-medium text-teal-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Cargo Volume Metrics */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                  <Package size={14} className="text-emerald-600" />
                  <span>Cargo Metrics & Volume</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total CTN (Cartons)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.totalCtn}
                      onChange={e => handleChange('totalCtn', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">CBM (Cubic Meters)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.cbm}
                      onChange={e => handleChange('cbm', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gross Weight (GW - KG)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.gw}
                      onChange={e => handleChange('gw', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Route & Status */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                  <MapPin size={14} className="text-purple-600" />
                  <span>Route & Real-time Status</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Origin Warehouse</label>
                    <select
                      value={formData.origin}
                      onChange={e => handleChange('origin', e.target.value as 'Guangzhou' | 'Yiwu')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Guangzhou">Guangzhou Warehouse</option>
                      <option value="Yiwu">Yiwu Warehouse</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Destination</label>
                    <input
                      type="text"
                      value={formData.destination || ''}
                      onChange={e => handleChange('destination', e.target.value)}
                      placeholder="e.g. Kathmandu"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Status</label>
                    <select
                      value={formData.status}
                      onChange={e => handleChange('status', e.target.value as Status)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-blue-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Special Notes</label>
                  <textarea
                    value={formData.remarks || ''}
                    onChange={e => handleChange('remarks', e.target.value)}
                    placeholder="Enter any additional cargo notes, customs documents, or special instructions..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-800 font-medium leading-relaxed">
                Logistics container loading and transit tracking schedule across all major Tibetan and Nepal border crossing checkpoints.
              </div>

              <div className="space-y-3">
                {TRANSIT_POINTS.map(tp => {
                  const tpData = formData.transitPoints?.[tp] || { containerNo: '', loadingDate: '' };
                  return (
                    <div key={tp} className="p-4 bg-white border border-slate-300 rounded-xl shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm tracking-wide flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                          <span>{tp} TRANSIT HUB</span>
                        </span>
                        {tpData.containerNo && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Active Container
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Container Number</label>
                          <input
                            type="text"
                            value={tpData.containerNo}
                            onChange={e => handleTransitChange(tp, 'containerNo', e.target.value)}
                            placeholder={`Container No for ${tp}`}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Loading Date</label>
                          <input
                            type="date"
                            value={tpData.loadingDate}
                            onChange={e => handleTransitChange(tp, 'loadingDate', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Dispatched To</label>
                          <input
                            type="text"
                            value={tpData.dispatchedTo || ''}
                            onChange={e => handleTransitChange(tp, 'dispatchedTo', e.target.value)}
                            placeholder={`Next destination from ${tp}`}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Loaded CTN</label>
                          <input
                            type="number"
                            min={0}
                            value={tpData.loadedCtn ?? ''}
                            onChange={e => handleTransitChange(tp, 'loadedCtn', e.target.value === '' ? null : Number(e.target.value))}
                            placeholder={`Cartons loaded at ${tp}`}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
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
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Save All Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
