import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Consignment, TRANSIT_POINTS } from '../types';
import { 
  BarChart3, TrendingUp, Package, Truck, 
  MapPin, CheckCircle, Clock, RefreshCw,
  PieChart, Layers, ArrowUpRight, HelpCircle, 
  ChevronDown, ChevronUp, ShieldCheck, Scale, 
  Building2, ArrowRight, Activity, Percent, Info,
  Printer, Filter, Compass, AlertCircle
} from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

export default function AnalyticsView() {
  const [data, setData] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);
  const [originFilter, setOriginFilter] = useState<'ALL' | 'Guangzhou' | 'Yiwu'>('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getConsignments();
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeRefresh('consignments', fetchData);

  // Filtered dataset based on origin selection
  const filteredData = useMemo(() => {
    if (originFilter === 'ALL') return data;
    return data.filter(c => c.origin === originFilter);
  }, [data, originFilter]);

  // Macro-level Analytics Calculations
  const stats = useMemo(() => {
    const totalConsignments = filteredData.length;
    const totalCbm = filteredData.reduce((sum, c) => sum + (c.cbm || 0), 0);
    const totalCtn = filteredData.reduce((sum, c) => sum + (c.totalCtn || 0), 0);
    const totalGw = filteredData.reduce((sum, c) => sum + (c.gw || 0), 0);

    const guangzhouAll = data.filter(c => c.origin === 'Guangzhou');
    const yiwuAll = data.filter(c => c.origin === 'Yiwu');

    const gzCbm = guangzhouAll.reduce((sum, c) => sum + (c.cbm || 0), 0);
    const ywCbm = yiwuAll.reduce((sum, c) => sum + (c.cbm || 0), 0);
    const combinedCbm = gzCbm + ywCbm || 1;

    // Delivery vs In-Transit
    const delivered = filteredData.filter(c => {
      const s = (c.status || '').toLowerCase();
      return s.includes('deliver');
    });
    const inTransit = filteredData.filter(c => {
      const s = (c.status || '').toLowerCase();
      return !s.includes('deliver');
    });

    const deliveryRate = totalConsignments > 0 
      ? Math.round((delivered.length / totalConsignments) * 100) 
      : 0;

    // Average density (KG per CBM)
    const avgDensity = totalCbm > 0 ? Math.round(totalGw / totalCbm) : 0;

    // Unique active containers
    const activeContainers = new Set<string>();
    filteredData.forEach(c => {
      TRANSIT_POINTS.forEach(tp => {
        const cont = c.transitPoints?.[tp]?.containerNo?.trim();
        if (cont) activeContainers.add(cont);
      });
    });

    // Pipeline Stages Breakdown
    const pipeline = {
      chinaWarehouse: { count: 0, cbm: 0, ctn: 0 },
      enRouteHighway: { count: 0, cbm: 0, ctn: 0 },
      transitHubs: { count: 0, cbm: 0, ctn: 0 },
      delivered: { count: 0, cbm: 0, ctn: 0 }
    };

    filteredData.forEach(c => {
      const s = (c.status || '').toLowerCase();
      const cbm = c.cbm || 0;
      const ctn = c.totalCtn || 0;

      if (s.includes('pending') || s.includes('guangzhou') || s.includes('yiwu')) {
        pipeline.chinaWarehouse.count++;
        pipeline.chinaWarehouse.cbm += cbm;
        pipeline.chinaWarehouse.ctn += ctn;
      } else if (s.startsWith('on the way')) {
        pipeline.enRouteHighway.count++;
        pipeline.enRouteHighway.cbm += cbm;
        pipeline.enRouteHighway.ctn += ctn;
      } else if (s.startsWith('at ') || s.includes('hub') || s.includes('border')) {
        pipeline.transitHubs.count++;
        pipeline.transitHubs.cbm += cbm;
        pipeline.transitHubs.ctn += ctn;
      } else if (s.includes('deliver')) {
        pipeline.delivered.count++;
        pipeline.delivered.cbm += cbm;
        pipeline.delivered.ctn += ctn;
      } else {
        pipeline.transitHubs.count++;
        pipeline.transitHubs.cbm += cbm;
        pipeline.transitHubs.ctn += ctn;
      }
    });

    // Border Corridor Distribution (Tatopani vs Kerung vs Rasuwa vs Nyalam)
    const borderCorridors: Record<string, { count: number; cbm: number; ctn: number }> = {
      'Tatopani': { count: 0, cbm: 0, ctn: 0 },
      'Kerung': { count: 0, cbm: 0, ctn: 0 },
      'Rasuwa': { count: 0, cbm: 0, ctn: 0 },
      'Nyalam': { count: 0, cbm: 0, ctn: 0 },
    };

    filteredData.forEach(c => {
      const s = (c.status || '').toLowerCase();
      const cbm = c.cbm || 0;
      const ctn = c.totalCtn || 0;

      if (s.includes('tatopani') || c.transitPoints?.TATOPANI?.containerNo) {
        borderCorridors['Tatopani'].count++;
        borderCorridors['Tatopani'].cbm += cbm;
        borderCorridors['Tatopani'].ctn += ctn;
      } else if (s.includes('kerung') || c.transitPoints?.KERUNG?.containerNo) {
        borderCorridors['Kerung'].count++;
        borderCorridors['Kerung'].cbm += cbm;
        borderCorridors['Kerung'].ctn += ctn;
      } else if (s.includes('rasuwa') || c.transitPoints?.RASUWA?.containerNo) {
        borderCorridors['Rasuwa'].count++;
        borderCorridors['Rasuwa'].cbm += cbm;
        borderCorridors['Rasuwa'].ctn += ctn;
      } else if (s.includes('nyalam') || s.includes('nylam') || c.transitPoints?.NYLAM?.containerNo) {
        borderCorridors['Nyalam'].count++;
        borderCorridors['Nyalam'].cbm += cbm;
        borderCorridors['Nyalam'].ctn += ctn;
      } else {
        // Default to Kerung corridor for northern routes
        borderCorridors['Kerung'].count++;
        borderCorridors['Kerung'].cbm += cbm;
        borderCorridors['Kerung'].ctn += ctn;
      }
    });

    // Client leaderboards
    const clientVolumes: Record<string, { cbm: number; ctn: number; count: number; dest: string }> = {};
    filteredData.forEach(c => {
      const name = c.clientName?.trim() || 'Unassigned Client';
      if (!clientVolumes[name]) {
        clientVolumes[name] = { cbm: 0, ctn: 0, count: 0, dest: c.destination || 'Kathmandu' };
      }
      clientVolumes[name].cbm += (c.cbm || 0);
      clientVolumes[name].ctn += (c.totalCtn || 0);
      clientVolumes[name].count += 1;
    });

    const topClients = Object.entries(clientVolumes)
      .map(([name, val]) => ({ 
        name, 
        ...val,
        sharePct: totalCbm > 0 ? Math.round((val.cbm / totalCbm) * 100) : 0
      }))
      .sort((a, b) => b.cbm - a.cbm)
      .slice(0, 7);

    return {
      totalConsignments,
      totalCbm,
      totalCtn,
      totalGw,
      avgDensity,
      activeContainersCount: activeContainers.size,
      deliveryRate,
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      guangzhouShare: Math.round((gzCbm / combinedCbm) * 100),
      yiwuShare: Math.round((ywCbm / combinedCbm) * 100),
      guangzhou: {
        count: guangzhouAll.length,
        cbm: gzCbm,
        ctn: guangzhouAll.reduce((sum, c) => sum + (c.totalCtn || 0), 0)
      },
      yiwu: {
        count: yiwuAll.length,
        cbm: ywCbm,
        ctn: yiwuAll.reduce((sum, c) => sum + (c.totalCtn || 0), 0)
      },
      pipeline,
      borderCorridors,
      topClients
    };
  }, [filteredData, data]);

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-200 print:m-0 print:p-0">
      
      {/* Top Action Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-inner shrink-0">
            <BarChart3 size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Freight Analytics & Operations Intelligence
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Macro capacity metrics, Trans-Himalayan corridor throughput, and client volume distribution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Origin Filter Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200">
            <button
              onClick={() => setOriginFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                originFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Hubs
            </button>
            <button
              onClick={() => setOriginFilter('Guangzhou')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                originFilter === 'Guangzhou'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-blue-600'
              }`}
            >
              Guangzhou
            </button>
            <button
              onClick={() => setOriginFilter('Yiwu')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                originFilter === 'Yiwu'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Yiwu
            </button>
          </div>

          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center space-x-1.5 ${
              showExplanation 
                ? 'bg-purple-50 text-purple-800 border-purple-300' 
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="Toggle guide explaining Freight Analytics"
          >
            <HelpCircle size={14} className="text-purple-600" />
            <span>{showExplanation ? 'Hide Guide' : 'What is this?'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors print:hidden"
            title="Print Analytics Report"
          >
            <Printer size={15} />
          </button>

          <button
            onClick={fetchData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 
        ========================================================================
        EXPLANATION BANNER: "WHAT IS FREIGHT ANALYTICS & HOW TO USE IT"
        ========================================================================
      */}
      {showExplanation && (
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-purple-700 shadow-md animate-in slide-in-from-top duration-200 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5 mb-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500 text-white flex items-center justify-center">
                <Info size={14} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">
                Understanding Freight Analytics & Operational Intelligence
              </h3>
            </div>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <ChevronUp size={16} />
            </button>
          </div>

          <p className="text-xs text-slate-200 font-medium leading-relaxed max-w-4xl mb-4">
            <strong>Freight Analytics</strong> is the command center that translates raw cross-border shipment records into actionable business decisions. It answers critical logistical questions:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
              <div className="font-bold text-purple-300 flex items-center space-x-1.5 mb-1">
                <Compass size={14} />
                <span>1. Route & Corridor Balancing</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-normal">
                Monitors cargo volumes moving through <strong>Tatopani</strong>, <strong>Kerung</strong>, and <strong>Rasuwa</strong> border corridors to prevent customs congestion.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
              <div className="font-bold text-blue-300 flex items-center space-x-1.5 mb-1">
                <Building2 size={14} />
                <span>2. Warehouse Throughput</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-normal">
                Compares packing capacity between <strong>Guangzhou Hub</strong> (heavy consolidation) and <strong>Yiwu Hub</strong> (commodity goods) to optimize container dispatches.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10">
              <div className="font-bold text-emerald-300 flex items-center space-x-1.5 mb-1">
                <TrendingUp size={14} />
                <span>3. Consignee Delivery Velocity</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-normal">
                Tracks top clients by CBM cargo volume, gross weight density, and real-time delivery completion rates across Nepal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        PRIMARY KPI STATS GRID (5 Core Logistics Metrics)
        ========================================================================
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total CBM */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Total Volume</span>
          <div className="my-1.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-slate-900">
              {formatNumber(stats.totalCbm)}
              <span className="text-xs font-bold text-slate-500 ml-1">CBM</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-1.5">
            <span>{formatNumber(stats.totalCtn)} Cartons</span>
            <span className="text-blue-600">{stats.totalConsignments} Lots</span>
          </div>
        </div>

        {/* In-Transit Active Cargo */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-white to-blue-50/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block">En Route Active</span>
          <div className="my-1.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-700">
              {stats.inTransitCount}
              <span className="text-xs font-bold text-blue-500 ml-1">Shipments</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-blue-600 border-t border-blue-100 pt-1.5">
            <span>Tibetan Highway</span>
            <span>{stats.activeContainersCount} Containers</span>
          </div>
        </div>

        {/* Delivered Cargo */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Delivered in Nepal</span>
          <div className="my-1.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
              {stats.deliveredCount}
              <span className="text-xs font-bold text-emerald-600 ml-1">Delivered</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 border-t border-emerald-100 pt-1.5">
            <span>Fulfillment Rate</span>
            <span className="font-mono">{stats.deliveryRate}%</span>
          </div>
        </div>

        {/* Gross Weight */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Total Gross Mass</span>
          <div className="my-1.5">
            <div className="text-xl sm:text-2xl font-black font-mono text-indigo-700">
              {formatNumber(stats.totalGw)}
              <span className="text-xs font-bold text-indigo-500 ml-1">KG</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-1.5">
            <span>Mass Density</span>
            <span className="text-indigo-600 font-mono">~{stats.avgDensity} kg/cbm</span>
          </div>
        </div>

        {/* Warehouse Volume Split */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Origin Hub Ratio</span>
          <div className="my-1.5 space-y-1">
            <div className="flex justify-between text-[11px] font-bold font-mono">
              <span className="text-blue-700">GZ: {stats.guangzhouShare}%</span>
              <span className="text-indigo-700">YW: {stats.yiwuShare}%</span>
            </div>
            {/* Visual ratio bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="bg-blue-600 h-full" style={{ width: `${stats.guangzhouShare}%` }} />
              <div className="bg-indigo-600 h-full" style={{ width: `${stats.yiwuShare}%` }} />
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-1.5 truncate">
            Guangzhou vs. Yiwu
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        CARGO CORRIDOR PIPELINE (Visual 4-Stage Flow)
        ========================================================================
      */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity size={18} className="text-blue-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Active Trans-Himalayan Cargo Flow Pipeline
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            China Origins → High-Altitude Corridors → Border Checkpoints → Final Handover
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stage 1: China Warehouse Consolidation */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 relative">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-1">
              <span className="flex items-center space-x-1">
                <Building2 size={13} className="text-blue-600" />
                <span>1. Warehouse Origin</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-200 text-blue-800 rounded">
                GZ / YW
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatNumber(stats.pipeline.chinaWarehouse.cbm)} <span className="text-xs text-slate-500 font-normal">CBM</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{stats.pipeline.chinaWarehouse.count} shipments</span>
              <span className="font-mono">{formatNumber(stats.pipeline.chinaWarehouse.ctn)} CTN</span>
            </div>
          </div>

          {/* Stage 2: In Route Highway */}
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 relative">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
              <span className="flex items-center space-x-1">
                <Truck size={13} className="text-amber-600" />
                <span>2. In Route Highway</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                Tibetan Route
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatNumber(stats.pipeline.enRouteHighway.cbm)} <span className="text-xs text-slate-500 font-normal">CBM</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{stats.pipeline.enRouteHighway.count} shipments</span>
              <span className="font-mono">{formatNumber(stats.pipeline.enRouteHighway.ctn)} CTN</span>
            </div>
          </div>

          {/* Stage 3: Transit & Border Hubs */}
          <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 relative">
            <div className="flex items-center justify-between text-xs font-bold text-purple-900 mb-1">
              <span className="flex items-center space-x-1">
                <MapPin size={13} className="text-purple-600" />
                <span>3. Border & Transit</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded">
                Customs
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatNumber(stats.pipeline.transitHubs.cbm)} <span className="text-xs text-slate-500 font-normal">CBM</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{stats.pipeline.transitHubs.count} shipments</span>
              <span className="font-mono">{formatNumber(stats.pipeline.transitHubs.ctn)} CTN</span>
            </div>
          </div>

          {/* Stage 4: Delivered in Nepal */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 relative">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-1">
              <span className="flex items-center space-x-1">
                <CheckCircle size={13} className="text-emerald-600" />
                <span>4. Delivered in Nepal</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded">
                Completed
              </span>
            </div>
            <div className="text-lg font-black font-mono text-slate-900 mt-1">
              {formatNumber(stats.pipeline.delivered.cbm)} <span className="text-xs text-slate-500 font-normal">CBM</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{stats.pipeline.delivered.count} shipments</span>
              <span className="font-mono">{formatNumber(stats.pipeline.delivered.ctn)} CTN</span>
            </div>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        CORRIDOR DISTRIBUTION & WAREHOUSE COMPARISON GRID
        ========================================================================
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* 1. Border Corridor Routing Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Compass size={18} className="text-indigo-600" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Nepal Border Corridor Routing Share
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Volume by Entry Route
            </span>
          </div>

          <div className="space-y-3">
            {(Object.entries(stats.borderCorridors) as [string, { count: number; cbm: number; ctn: number }][]).map(([corridor, cData]) => {
              const pct = stats.totalCbm > 0 ? Math.round((cData.cbm / stats.totalCbm) * 100) : 0;
              return (
                <div key={corridor} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                      <span>{corridor} Corridor</span>
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {formatNumber(cData.cbm)} CBM <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{cData.count} Consignments</span>
                    <span>{formatNumber(cData.ctn)} Cartons</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Warehouse Hub Breakdown (Guangzhou vs Yiwu) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Building2 size={18} className="text-blue-600" />
              <h3 className="font-extrabold text-sm text-slate-900">
                China Warehouse Throughput Comparison
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Consolidation Hub Metrics
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Guangzhou */}
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-blue-900">Guangzhou Hub</span>
                <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-mono">
                  {stats.guangzhouShare}%
                </span>
              </div>
              <div className="text-xl font-black font-mono text-blue-950">
                {formatNumber(stats.guangzhou.cbm)} <span className="text-xs text-blue-600 font-normal">CBM</span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-blue-100 pt-1.5">
                <div className="flex justify-between">
                  <span>Shipments:</span>
                  <strong className="font-mono">{stats.guangzhou.count}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Cartons:</span>
                  <strong className="font-mono">{formatNumber(stats.guangzhou.ctn)}</strong>
                </div>
              </div>
            </div>

            {/* Yiwu */}
            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-indigo-900">Yiwu Hub</span>
                <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded font-mono">
                  {stats.yiwuShare}%
                </span>
              </div>
              <div className="text-xl font-black font-mono text-indigo-950">
                {formatNumber(stats.yiwu.cbm)} <span className="text-xs text-indigo-600 font-normal">CBM</span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-indigo-100 pt-1.5">
                <div className="flex justify-between">
                  <span>Shipments:</span>
                  <strong className="font-mono">{stats.yiwu.count}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Total Cartons:</span>
                  <strong className="font-mono">{formatNumber(stats.yiwu.ctn)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center space-x-2 text-[11px] text-slate-600">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Guangzhou handles major heavy cargo; Yiwu specializes in diverse small commodity consignments.</span>
          </div>
        </div>

      </div>

      {/* 
        ========================================================================
        TOP CLIENTS & CONSIGNEES LEADERBOARD
        ========================================================================
      */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <TrendingUp size={18} className="text-emerald-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Top Clients by Cargo Volume & Freight Distribution
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            VIP Consignees & Importers
          </span>
        </div>

        <div className="overflow-auto custom-scrollbar max-h-[calc(100vh-260px)] overscroll-contain">
          <table className="w-full text-center border-collapse border border-slate-300 text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 text-white font-bold">
              <tr>
                <th className="border border-slate-700 p-2 w-12 text-center">Rank</th>
                <th className="border border-slate-700 p-2 text-left">Client / Consignee</th>
                <th className="border border-slate-700 p-2 text-center">Primary Destination</th>
                <th className="border border-slate-700 p-2 text-center">Shipments</th>
                <th className="border border-slate-700 p-2 text-center">Total Cartons</th>
                <th className="border border-slate-700 p-2 text-center bg-blue-950 text-blue-200">Total Volume (CBM)</th>
                <th className="border border-slate-700 p-2 text-center w-28">Volume Share</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {stats.topClients.map((client, idx) => (
                <tr key={client.name} className="hover:bg-blue-50/40 transition-colors">
                  <td className="border border-slate-300 p-2 font-bold font-mono text-slate-500">
                    #{idx + 1}
                  </td>
                  <td className="border border-slate-300 p-2 font-extrabold text-left text-slate-900">
                    {client.name}
                  </td>
                  <td className="border border-slate-300 p-2 text-slate-600 font-medium">
                    {client.dest}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono font-bold text-slate-800">
                    {client.count}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono text-slate-700">
                    {formatNumber(client.ctn)} CTN
                  </td>
                  <td className="border border-slate-300 p-2 font-mono font-extrabold text-blue-700 bg-blue-50/30">
                    {formatNumber(client.cbm)} CBM
                  </td>
                  <td className="border border-slate-300 p-2">
                    <div className="flex items-center space-x-1.5 justify-center">
                      <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${Math.max(client.sharePct, 4)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 font-bold">{client.sharePct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
