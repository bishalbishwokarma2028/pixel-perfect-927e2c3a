import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Consignment, Status } from '../types';
import { 
  Loader2, Building2, Truck, MapPin, CheckCircle2, 
  ArrowLeft, FileSpreadsheet, RefreshCw, Layers, 
  Search, X, Sparkles, Box, ShieldCheck,
  SlidersHorizontal, Eye, ExternalLink
} from 'lucide-react';
import { formatNumber } from '../lib/utils';
import ExcelTable from './ExcelTable';
import EditConsignmentModal from './EditConsignmentModal';
import CargoReceiptModal from './CargoReceiptModal';
import ConsignmentDetailModal from './ConsignmentDetailModal';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

// Status key mapping helper to handle aliases
const normalizeStatusKey = (status: string): string => {
  if (!status) return '';
  const s = status.trim().toLowerCase();
  
  if (s.includes('guangzhou')) return 'Pending in Guangzhou';
  if (s.includes('yiwu')) return 'Pending in Yiwu';
  
  if (s.includes('on the way to lhasa')) return 'On the way to Lhasa';
  if (s.includes('on the way to nyalam') || s.includes('on the way to nylam') || s.includes('on the way to nalam')) return 'On the way to Nyalam';
  if (s.includes('on the way to kerung') || s.includes('on the way to kairung')) return 'On the way to Kerung';
  if (s.includes('on the way to tatopani') || s.includes('on the way to totope') || s.includes('on the way to hot water')) return 'On the way to Tatopani';
  if (s.includes('on the way to rasuwa')) return 'On the way to Rasuwa';
  
  if (s === 'at lhasa' || s.includes('at lhasa') || s.includes('at lasa')) return 'At Lhasa';
  if (s === 'at nyalam' || s.includes('at nyalam') || s === 'at nylam' || s.includes('at nylam') || s.includes('at nalam')) return 'At Nyalam';
  if (s === 'at kerung' || s.includes('at kerung') || s.includes('at kairung')) return 'At Kerung';
  if (s === 'at tatopani' || s.includes('at tatopani') || s.includes('at totope')) return 'At Tatopani';
  if (s === 'at rasuwa' || s.includes('at rasuwa')) return 'At Rasuwa';
  
  if (s.includes('nyalam deliver') || s.includes('nalam deliver') || s.includes('nylam deliver') || s.includes('nyalam delivered') || s.includes('nalam delivered') || s.includes('nylam delivered')) return 'Nyalam Deliver';
  if (s.includes('kerung deliver') || s.includes('kairung deliver') || s.includes('kerung delivered')) return 'Kerung Deliver';
  if (s.includes('tatopani deliver') || s.includes('hot water deliver') || s.includes('totope deliver') || s.includes('tatopani delivered')) return 'Tatopani Deliver';
  if (s.includes('rasuwa deliver') || s.includes('rasuwa delivered')) return 'Rasuwa Deliver';
  
  return status;
};

// Categorize consignment to top-level classification
const getCategoryName = (status: string): string => {
  const norm = normalizeStatusKey(status);
  if (norm.includes('Guangzhou') || norm.includes('Yiwu')) return 'China Warehouses';
  if (norm.startsWith('On the way')) return 'In Route Highway';
  if (norm.startsWith('At ')) return 'Transit and Border Hubs';
  if (norm.includes('Deliver')) return 'Goods Delivered';
  return 'Other Status';
};

export default function InventoryView() {
  const [data, setData] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string>('');
  const [editingConsignment, setEditingConsignment] = useState<Consignment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Consignment | null>(null);
  const [viewingDetail, setViewingDetail] = useState<Consignment | null>(null);
  
  // High-positioned Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getConsignments();
      setData(res);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeRefresh('consignments', fetchData);

  const handleEditSave = async (id: string, updates: Partial<Consignment>) => {
    await api.updateConsignment(id, updates);
    setData(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleDelete = async (id: string) => {
    await api.deleteConsignment(id);
    setData(prev => prev.filter(c => c.id !== id));
  };

  // Inventory count calculations with normalized keys
  const inventoryCounts = useMemo(() => {
    const counts: Record<string, { count: number; ctn: number; cbm: number; matchingIds: Set<string> }> = {
      'Pending in Guangzhou': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'Pending in Yiwu': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'On the way to Lhasa': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'At Lhasa': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'On the way to Nyalam': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'At Nyalam': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'On the way to Kerung': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'At Kerung': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'On the way to Tatopani': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'At Tatopani': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'On the way to Rasuwa': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'At Rasuwa': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'Nyalam Deliver': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'Kerung Deliver': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
      'Tatopani Deliver': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() }, 
      'Rasuwa Deliver': { count: 0, ctn: 0, cbm: 0, matchingIds: new Set() },
    };

    data.forEach(c => {
      const normKey = normalizeStatusKey(c.status);
      if (counts[normKey]) {
        counts[normKey].count++;
        counts[normKey].ctn += (c.totalCtn || 0);
        counts[normKey].cbm += (c.cbm || 0);
      }
    });

    return counts;
  }, [data]);

  // Search Results filtering by Consignment No, Marka, Lot No, Client
  const searchResults = useMemo(() => {
    const query = activeSearch.trim().toLowerCase();
    if (!query) return [];

    return data.filter(c => {
      const matchConsignment = (c.consignmentNo || '').toLowerCase().includes(query);
      const matchMarka = (c.marka || '').toLowerCase().includes(query);
      const matchClient = (c.clientName || '').toLowerCase().includes(query);
      const matchLot = (c.lotNo || '').toLowerCase().includes(query);
      return matchConsignment || matchMarka || matchClient || matchLot;
    });
  }, [data, activeSearch]);

  // Track categories that match the active search
  const matchedCategories = useMemo(() => {
    const categories = new Set<string>();
    searchResults.forEach(c => {
      categories.add(getCategoryName(c.status));
    });
    return categories;
  }, [searchResults]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium text-sm">Loading inventory database...</p>
      </div>
    );
  }

  // If a status is selected, open the dedicated Full-Page Excel View!
  if (selectedStatus) {
    const filteredConsignments = data.filter(c => normalizeStatusKey(c.status) === selectedStatus);
    const subTotals = filteredConsignments.reduce(
      (acc, curr) => {
        acc.ctn += curr.totalCtn || 0;
        acc.cbm += curr.cbm || 0;
        acc.gw += curr.gw || 0;
        return acc;
      },
      { ctn: 0, cbm: 0, gw: 0 }
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Dedicated Page Header & Breadcrumb */}
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedStatus(null)}
              className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl border border-slate-300 hover:border-blue-300 transition-all flex items-center space-x-2 font-bold text-sm shadow-xs"
              title="Return to Inventory Stock Overview"
            >
              <ArrowLeft size={18} />
              <span>Back to Overview</span>
            </button>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Inventory Stock</span>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {selectedCategoryTitle || selectedStatus}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {selectedStatus}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-right">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">Total Volume</span>
              <span className="text-sm font-extrabold text-slate-900">
                {formatNumber(subTotals.ctn)} CTN / {formatNumber(subTotals.cbm)} CBM
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Full-Page Excel Grid Table */}
        <ExcelTable
          data={filteredConsignments}
          title={`ADO International - ${selectedStatus} Inventory Ledger`}
          subtitle={`Current stock and transit consignment records for ${selectedStatus}`}
          filenamePrefix={`Inventory_${selectedStatus.replace(/\s+/g, '_')}`}
          onEdit={setEditingConsignment}
          onDelete={handleDelete}
          onInlineUpdate={handleEditSave}
          showActions={true}
        />

        {/* Individual Edit / View Modal */}
        {editingConsignment && (
          <EditConsignmentModal
            consignment={editingConsignment}
            onClose={() => setEditingConsignment(null)}
            onSave={handleEditSave}
          />
        )}
      </div>
    );
  }

  // Modern Minimalist Category Section Card
  const SectionCard = ({ 
    title, 
    icon: Icon, 
    items, 
    color,
    badgeBg,
    borderColor
  }: { 
    title: string; 
    icon: any; 
    items: { label: string; key: string }[]; 
    color: string;
    badgeBg: string;
    borderColor: string;
  }) => {
    const isCategoryMatched = activeSearch && matchedCategories.has(title);

    return (
      <div className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col justify-between transition-all duration-200 ${
        isCategoryMatched 
          ? 'ring-2 ring-blue-500 border-blue-400 shadow-md bg-blue-50/10' 
          : 'border-slate-300'
      }`}>
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className={`p-2.5 rounded-xl ${badgeBg} ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">{title}</h3>
                <p className="text-[11px] text-slate-400 font-medium">Click to open full Excel report</p>
              </div>
            </div>

            {isCategoryMatched && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                Matched
              </span>
            )}
          </div>

          <div className="space-y-2">
            {items.map(item => {
              const stats = inventoryCounts[item.key] || { count: 0, ctn: 0, cbm: 0 };
              
              // Check if any search result item has this status
              const hasMatchingItems = activeSearch && searchResults.some(r => normalizeStatusKey(r.status) === item.key);

              return (
                <button 
                  key={item.key} 
                  onClick={() => {
                    setSelectedStatus(item.key);
                    setSelectedCategoryTitle(title);
                  }}
                  className={`w-full flex justify-between items-center px-3.5 py-2.5 rounded-xl border transition-all duration-150 text-left group ${
                    hasMatchingItems
                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-blue-400 hover:shadow-xs'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-slate-800 text-xs group-hover:text-blue-600 transition-colors truncate">
                      {item.label}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border transition-all ${
                      hasMatchingItems 
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                        : 'text-slate-900 bg-white group-hover:bg-blue-50 group-hover:text-blue-600 border-slate-200 group-hover:border-blue-300'
                    }`}>
                      {stats.count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-200">
      {/* High-Positioned Search Deck & Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-inner shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Stock Dashboard</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time stock ledger across China consolidation hubs, Tibetan mountain corridors, and Nepal borders
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Total In System</span>
              <span className="text-sm font-black text-blue-900">{data.length} Consignments</span>
            </div>
            <button
              onClick={fetchData}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors"
              title="Refresh Inventory"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* HIGHER POSITIONED SEARCH BAR WITH DEDICATED SEARCH BUTTON */}
        <form onSubmit={handleSearchSubmit} className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                // Also live search if typed
                setActiveSearch(e.target.value);
              }}
              placeholder="Search by Consignment Number (e.g. GZ-1001), Marka Code (e.g. ABC-1), or Client Name..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-xs transition-colors shrink-0"
          >
            <Search size={14} />
            <span>Search Stock</span>
          </button>
        </form>
      </div>

      {/* HIGHLIGHTED SEARCH RESULTS DRAWER & CATEGORY MATCHING */}
      {activeSearch && (
        <div className="bg-white rounded-2xl border-2 border-blue-400 p-5 shadow-md space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sparkles size={18} className="text-blue-600" />
              <span className="font-extrabold text-sm text-slate-900">
                Search Results for "{activeSearch}"
              </span>
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {searchResults.length} {searchResults.length === 1 ? 'Record' : 'Records'} Found
              </span>
            </div>

            {/* Matched Categories Tags */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Matched Categories:</span>
              {Array.from(matchedCategories).map(cat => (
                <span key={cat} className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                  {cat}
                </span>
              ))}
              <button
                onClick={handleClearSearch}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline ml-2"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Clickable Items Grid */}
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {searchResults.map(c => {
                const categoryName = getCategoryName(c.status);
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all shadow-xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-black text-xs text-blue-700">
                          {c.consignmentNo}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                          {categoryName}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        {c.clientName || 'Unknown Client'}
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-1">
                        {c.marka && <span className="bg-indigo-50 text-indigo-700 px-1.5 rounded font-bold">#{c.marka}</span>}
                        <span>{formatNumber(c.totalCtn)} CTN</span>
                        <span>•</span>
                        <span>{formatNumber(c.cbm)} CBM</span>
                      </div>
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 truncate max-w-[140px]">{c.status}</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setViewingDetail(c)}
                          className="px-2 py-1 bg-white hover:bg-blue-600 hover:text-white text-blue-700 rounded-md border border-blue-200 transition-colors text-[11px] font-bold flex items-center space-x-1 shadow-2xs"
                          title="View full consignment details"
                        >
                          <Eye size={12} />
                          <span>Details</span>
                        </button>
                        <button
                          onClick={() => setViewingReceipt(c)}
                          className="px-2 py-1 bg-white hover:bg-slate-900 hover:text-white text-slate-700 rounded-md border border-slate-200 transition-colors text-[11px] font-bold flex items-center space-x-1 shadow-2xs"
                          title="View Official Cargo Receipt"
                        >
                          <ExternalLink size={12} />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs font-medium">
              No matching consignments or markas found in inventory stock.
            </div>
          )}
        </div>
      )}

      {/* 4 Category Matrix Grid with Modernized Minimalist Icons */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* 1. China Warehouses */}
        <SectionCard 
          title="China Warehouses" 
          icon={Building2} 
          color="text-blue-700"
          badgeBg="bg-blue-100"
          borderColor="border-blue-200"
          items={[
            { label: 'Guangzhou Warehouse', key: 'Pending in Guangzhou' },
            { label: 'Yiwu Warehouse', key: 'Pending in Yiwu' }
          ]} 
        />
        
        {/* 2. In Route Highway */}
        <SectionCard 
          title="In Route Highway" 
          icon={Truck} 
          color="text-amber-700"
          badgeBg="bg-amber-100"
          borderColor="border-amber-200"
          items={[
            { label: 'On the way to Lhasa', key: 'On the way to Lhasa' },
            { label: 'On the way to Nyalam', key: 'On the way to Nyalam' },
            { label: 'On the way to Kerung', key: 'On the way to Kerung' },
            { label: 'On the way to Tatopani', key: 'On the way to Tatopani' },
            { label: 'On the way to Rasuwa', key: 'On the way to Rasuwa' }
          ]} 
        />

        {/* 3. Transit and Border Hubs */}
        <SectionCard 
          title="Transit and Border Hubs" 
          icon={MapPin} 
          color="text-purple-700"
          badgeBg="bg-purple-100"
          borderColor="border-purple-200"
          items={[
            { label: 'At Lhasa Hub', key: 'At Lhasa' },
            { label: 'At Nyalam Hub', key: 'At Nyalam' },
            { label: 'At Kerung Border', key: 'At Kerung' },
            { label: 'At Tatopani Border', key: 'At Tatopani' },
            { label: 'At Rasuwa Border', key: 'At Rasuwa' }
          ]} 
        />

        {/* 4. Goods Delivered */}
        <SectionCard 
          title="Goods Delivered" 
          icon={CheckCircle2} 
          color="text-emerald-700"
          badgeBg="bg-emerald-100"
          borderColor="border-emerald-200"
          items={[
            { label: 'Nyalam Deliver', key: 'Nyalam Deliver' },
            { label: 'Kerung Deliver', key: 'Kerung Deliver' },
            { label: 'Tatopani Deliver', key: 'Tatopani Deliver' },
            { label: 'Rasuwa Deliver', key: 'Rasuwa Deliver' }
          ]} 
        />
      </div>

      {/* Individual Edit / Detail Modal */}
      {editingConsignment && (
        <EditConsignmentModal
          consignment={editingConsignment}
          onClose={() => setEditingConsignment(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Full Consignment Detail (same rich view as the eye button in Actions) */}
      <ConsignmentDetailModal
        consignment={viewingDetail}
        onClose={() => setViewingDetail(null)}
      />

      {/* Cargo Official Receipt Modal */}
      <CargoReceiptModal
        consignment={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />

    </div>
  );
}
