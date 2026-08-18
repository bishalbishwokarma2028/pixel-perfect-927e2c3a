import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { api } from '../api';
import { Consignment, Status } from '../types';
import { formatNumber } from '../lib/utils';
import { 
  Building2, Truck, CheckCircle2, Search, ArrowRight, 
  Loader2, MapPin, ClipboardList, Bot, Layers, 
  TrendingUp, ArrowUpRight, ShieldCheck, Clock,
  PackageCheck, FileSpreadsheet, Sparkles, Navigation
} from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import { View } from '../views';
import EditConsignmentModal from './EditConsignmentModal';
import CargoReceiptModal from './CargoReceiptModal';
import { Eye } from 'lucide-react';

interface DashboardProps {
  onViewChange: (view: View) => void;
  onClientSelect: (client: string) => void;
}

export default function Dashboard({ onViewChange, onClientSelect }: DashboardProps) {
  const [data, setData] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Consignment | null>(null);

  const fetchData = useCallback(() => {
    api.getConsignments().then(res => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeRefresh('consignments', fetchData);


  const handleEditSave = async (id: string, updates: Partial<Consignment>) => {
    await api.updateConsignment(id, updates);
    setData(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const isDelivered = (s: string) => s && (s.includes('Deliver') || s.includes('Delivered'));
  const isPendingWarehouse = (s: string) => s && s.includes('Pending');

  const stats = useMemo(() => {
    const active = data.filter(c => !isDelivered(c.status));
    const delivered = data.filter(c => isDelivered(c.status));
    const inTransit = data.filter(c => !isDelivered(c.status) && !isPendingWarehouse(c.status));
    const warehouseStock = data.filter(c => isPendingWarehouse(c.status));

    const totalCBM = data.reduce((acc, c) => acc + (c.cbm || 0), 0);
    const totalCTN = data.reduce((acc, c) => acc + (c.totalCtn || 0), 0);
    const totalGW = data.reduce((acc, c) => acc + (c.gw || 0), 0);

    const guangzhouCount = data.filter(c => c.origin === 'Guangzhou').length;
    const yiwuCount = data.filter(c => c.origin === 'Yiwu').length;

    // Checkpoints
    const lhasaCount = data.filter(c => c.status?.toLowerCase().includes('lhasa') || c.status?.toLowerCase().includes('lasa')).length;
    const nylamCount = data.filter(c => c.status?.toLowerCase().includes('nylam') || c.status?.toLowerCase().includes('nalam')).length;
    const kerungCount = data.filter(c => c.status?.toLowerCase().includes('kerung') || c.status?.toLowerCase().includes('kairung')).length;
    const tatopaniCount = data.filter(c => c.status?.toLowerCase().includes('tatopani') || c.status?.toLowerCase().includes('totope') || c.status?.toLowerCase().includes('hot water')).length;
    const rasuwaCount = data.filter(c => c.status?.toLowerCase().includes('rasuwa')).length;

    return {
      activeCount: active.length,
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      warehouseCount: warehouseStock.length,
      totalCBM,
      totalCTN,
      totalGW,
      guangzhouCount,
      yiwuCount,
      lhasaCount,
      nylamCount,
      kerungCount,
      tatopaniCount,
      rasuwaCount
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-slate-500 font-medium text-xs">Loading logistics dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              ADO International
            </span>
            <span className="text-xs text-slate-400 font-medium">China-Nepal Cross-Border Freight</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Enterprise Logistics Dashboard
          </h2>
        </div>

        <div className="w-full md:w-96">
          <GlobalSearch data={data} onClientSelect={onClientSelect} />
        </div>
      </div>

      {/* 4 Refined Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Shipments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Shipments</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-110 transition-transform">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.activeCount}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              <span className="text-blue-600 font-bold">{stats.warehouseCount} in China</span> • <span className="text-indigo-600 font-bold">{stats.inTransitCount} in Transit</span>
            </div>
          </div>
        </div>

        {/* In Transit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm hover:shadow-md hover:border-amber-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Highway Transit</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 group-hover:scale-110 transition-transform">
              <Truck size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.inTransitCount}</div>
            <div className="text-xs text-amber-700 font-medium mt-1">
              Moving through Tibetan Hubs
            </div>
          </div>
        </div>

        {/* Delivered to Nepal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Delivered in Nepal</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.deliveredCount}</div>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              Successfully cleared & handed over
            </div>
          </div>
        </div>

        {/* Total Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Volume & Mass</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{formatNumber(stats.totalCBM)} <span className="text-sm font-bold text-slate-500">CBM</span></div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              {formatNumber(stats.totalCTN)} CTN • {formatNumber(stats.totalGW)} KG
            </div>
          </div>
        </div>
      </div>

      {/* Transit Corridor Visualizer & Warehouse Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Transit Highway Pipeline Status */}
        <div className="lg:col-span-8 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center space-x-2.5">
                <Navigation size={18} className="text-blue-400" />
                <h3 className="font-extrabold text-sm tracking-tight text-slate-100">
                  China-Nepal Freight Artery Checkpoints
                </h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Live Status
              </span>
            </div>

            {/* Pipeline Step Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5 font-mono">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Warehouses</span>
                <span className="text-xl font-black text-white">{stats.warehouseCount}</span>
                <span className="text-[10px] text-blue-400 block font-sans">GZ + YIWU</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Lhasa Hub</span>
                <span className="text-xl font-black text-blue-300">{stats.lhasaCount}</span>
                <span className="text-[10px] text-slate-400 block font-sans">En route/Hub</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Nyalam Hub</span>
                <span className="text-xl font-black text-purple-300">{stats.nylamCount}</span>
                <span className="text-[10px] text-slate-400 block font-sans">En route/Hub</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Border Points</span>
                <span className="text-xl font-black text-emerald-300">{stats.kerungCount + stats.tatopaniCount + stats.rasuwaCount}</span>
                <span className="text-[10px] text-slate-400 block font-sans">Kerung/Tato/Rasuwa</span>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">Delivered</span>
                <span className="text-xl font-black text-emerald-400">{stats.deliveredCount}</span>
                <span className="text-[10px] text-emerald-300 block font-sans">Nepal Arrived</span>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs">
              <span className="text-slate-400">
                Total consignments logged in system: <strong className="text-white">{data.length}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onViewChange('inventory')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors border border-slate-700"
                >
                  View Inventory Stock
                </button>
                <button 
                  onClick={() => onViewChange('lots')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors shadow-sm"
                >
                  Lot Batch Manager →
                </button>

              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Quick Navigation Links */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-300 shadow-sm p-5 flex flex-col justify-between space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-1">
            Logistics Workspace
          </h3>

          <div className="space-y-2 flex-1">
            <button 
              onClick={() => onViewChange('guangzhou')} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-slate-200 transition-all text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-110 transition-transform">
                  <Building2 size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block group-hover:text-blue-700">Guangzhou Warehouse</span>
                  <span className="text-[10px] text-slate-400 font-medium">{stats.guangzhouCount} Consignments logged</span>
                </div>
              </div>
              <ArrowRight size={15} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => onViewChange('yiwu')} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-200 transition-all text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg group-hover:scale-110 transition-transform">
                  <Building2 size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block group-hover:text-indigo-700">Yiwu Warehouse</span>
                  <span className="text-[10px] text-slate-400 font-medium">{stats.yiwuCount} Consignments logged</span>
                </div>
              </div>
              <ArrowRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => onViewChange('clients')} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 transition-all text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-110 transition-transform">
                  <Truck size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block group-hover:text-emerald-700">Client Directory</span>
                  <span className="text-[10px] text-slate-400 font-medium">Manage client accounts & markas</span>
                </div>
              </div>
              <ArrowRight size={15} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => onViewChange('notes')} 
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 transition-all text-left group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg group-hover:scale-110 transition-transform">
                  <ClipboardList size={16} />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block group-hover:text-amber-700">Notes & Voice Memos</span>
                  <span className="text-[10px] text-slate-400 font-medium">Record voice notes & photo attachments</span>
                </div>
              </div>
              <ArrowRight size={15} className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Cargo Records Table Preview */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet size={18} className="text-blue-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Recent Consignment Entries</h3>
          </div>

          <button 
            onClick={() => onViewChange('guangzhou')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>Open Complete Ledger</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-260px)] overscroll-contain">
          <table className="w-full text-center border-collapse border border-slate-300 text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white font-bold">
              <tr>
                <th className="border border-slate-600 p-2">Date</th>
                <th className="border border-slate-600 p-2 text-left">Consignment No</th>
                <th className="border border-slate-600 p-2">Lot No</th>
                <th className="border border-slate-600 p-2 text-left">Client Name</th>
                <th className="border border-slate-600 p-2">Marka</th>
                <th className="border border-slate-600 p-2">CTN</th>
                <th className="border border-slate-600 p-2">CBM</th>
                <th className="border border-slate-600 p-2">Status</th>
                <th className="border border-slate-600 p-2 w-16">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {data.slice(0, 5).map(c => (
                <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="border border-slate-300 p-2 font-mono">{c.date || '-'}</td>
                  <td className="border border-slate-300 p-2 font-bold text-left text-blue-700">{c.consignmentNo}</td>
                  <td className="border border-slate-300 p-2 font-mono">{c.lotNo || '-'}</td>
                  <td className="border border-slate-300 p-2 font-bold text-left text-slate-900">{c.clientName || '-'}</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-indigo-700">{c.marka || '-'}</td>
                  <td className="border border-slate-300 p-2 font-mono">{formatNumber(c.totalCtn)}</td>
                  <td className="border border-slate-300 p-2 font-mono font-bold">{formatNumber(c.cbm)}</td>
                  <td className="border border-slate-300 p-2 font-semibold text-slate-700">{c.status}</td>
                  <td className="border border-slate-300 p-2">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => setViewingReceipt(c)}
                        className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 transition-colors"
                        title="View & Copy Official Cargo Receipt Slip"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => setSelectedConsignment(c)}
                        className="px-2 py-1 bg-slate-100 hover:bg-blue-100 text-blue-700 font-bold rounded text-[11px] transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedConsignment && (
        <EditConsignmentModal
          consignment={selectedConsignment}
          onClose={() => setSelectedConsignment(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Cargo Official Receipt Modal */}
      <CargoReceiptModal
        consignment={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}
