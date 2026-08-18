import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api';
import { Consignment } from '../types';
import { 
  Users, ChevronRight, Loader2, ArrowLeft, 
  Search, RefreshCw, MessageSquare, Copy, Check, 
  Download, FileSpreadsheet, Building2, Tag, Package, Truck, X
} from 'lucide-react';
import { formatNumber } from '../lib/utils';
import { exportClientLedgerToExcel } from '../lib/excelExport';
import ExcelTable from './ExcelTable';
import EditConsignmentModal from './EditConsignmentModal';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

interface MatchedInfo {
  matchedMarkas: string[];
  matchedConsignmentNos: string[];
  matchedContainers: string[];
  matchedLotNos: string[];
}

export default function ClientsView({ onClientSelect }: { onClientSelect?: (clientName: string) => void }) {
  const [data, setData] = useState<Consignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConsignment, setEditingConsignment] = useState<Consignment | null>(null);
  
  // WhatsApp Statement Generator Modal State
  const [whatsAppModalClient, setWhatsAppModalClient] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getConsignments();
      setData(res);
    } catch (err) {
      console.error('Failed to load clients data:', err);
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
    if (!window.confirm('Are you sure you want to delete this consignment record?')) return;
    await api.deleteConsignment(id);
    setData(prev => prev.filter(c => c.id !== id));
  };

  // Aggregate client data
  const clientStats = useMemo(() => {
    const map = new Map<string, {
      name: string;
      markas: Set<string>;
      totalShipments: number;
      consignments: Consignment[];
    }>();

    data.forEach(c => {
      const name = (c.clientName || 'Unknown Client').trim();
      if (!map.has(name)) {
        map.set(name, {
          name,
          markas: new Set<string>(),
          totalShipments: 0,
          consignments: []
        });
      }

      const client = map.get(name)!;
      client.consignments.push(c);
      if (c.marka?.trim()) client.markas.add(c.marka.trim());
      client.totalShipments += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.totalShipments - a.totalShipments || a.name.localeCompare(b.name));
  }, [data]);

  // Comprehensive multi-attribute search (Client Name, Marka, Consignment No, Lot No, Container No, Destination)
  const filteredClientsWithMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return clientStats.map(c => ({ client: c, matches: null as MatchedInfo | null }));
    }

    const results: { client: typeof clientStats[0]; matches: MatchedInfo }[] = [];

    clientStats.forEach(client => {
      const nameMatches = client.name.toLowerCase().includes(q);
      const matchedMarkas: string[] = [];
      const matchedConsignmentNos: string[] = [];
      const matchedContainers: string[] = [];
      const matchedLotNos: string[] = [];

      client.consignments.forEach(c => {
        if (c.marka && c.marka.toLowerCase().includes(q)) {
          if (!matchedMarkas.includes(c.marka)) matchedMarkas.push(c.marka);
        }
        if (c.consignmentNo && c.consignmentNo.toLowerCase().includes(q)) {
          if (!matchedConsignmentNos.includes(c.consignmentNo)) matchedConsignmentNos.push(c.consignmentNo);
        }
        if (c.lotNo && c.lotNo.toLowerCase().includes(q)) {
          if (!matchedLotNos.includes(c.lotNo)) matchedLotNos.push(c.lotNo);
        }
        if (c.destination && c.destination.toLowerCase().includes(q)) {
          // match by destination
        }
        if (c.transitPoints) {
          Object.values(c.transitPoints).forEach((tp: any) => {
            if (tp?.containerNo && typeof tp.containerNo === 'string' && tp.containerNo.toLowerCase().includes(q)) {
              if (!matchedContainers.includes(tp.containerNo)) matchedContainers.push(tp.containerNo);
            }
          });
        }
      });

      const isMatch = nameMatches || 
        matchedMarkas.length > 0 || 
        matchedConsignmentNos.length > 0 || 
        matchedContainers.length > 0 || 
        matchedLotNos.length > 0;

      if (isMatch) {
        results.push({
          client,
          matches: {
            matchedMarkas,
            matchedConsignmentNos,
            matchedContainers,
            matchedLotNos,
          }
        });
      }
    });

    return results;
  }, [clientStats, searchQuery]);

  // Handle Search Submission (clicking Search button or pressing Enter)
  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    if (filteredClientsWithMatches.length === 1) {
      // Direct immediately to that client!
      setSelectedClient(filteredClientsWithMatches[0].client.name);
    } else if (filteredClientsWithMatches.length > 1) {
      // Check if there is an exact match for client name, marka, or consignment number
      const exactMatch = filteredClientsWithMatches.find(item => 
        item.client.name.toLowerCase() === q.toLowerCase() ||
        item.matches?.matchedConsignmentNos.some(cn => cn.toLowerCase() === q.toLowerCase()) ||
        item.matches?.matchedMarkas.some(m => m.toLowerCase() === q.toLowerCase())
      );
      if (exactMatch) {
        setSelectedClient(exactMatch.client.name);
      }
    }
  };

  // WhatsApp Message Generator
  const generateWhatsAppMessage = (clientName: string) => {
    const client = clientStats.find(c => c.name === clientName);
    if (!client) return '';

    const markasStr = Array.from(client.markas).join(', ') || 'Standard';
    let text = `📦 *ADO INTERNATIONAL TRANSPORT NEPAL*\n`;
    text += `*SHIPMENT STATUS UPDATE FOR:* ${client.name.toUpperCase()}\n`;
    text += `*Registered Marka(s):* ${markasStr}\n`;
    text += `*Total Shipments:* ${client.totalShipments} Consignments\n`;
    text += `------------------------------------\n\n`;

    client.consignments.forEach((c, idx) => {
      text += `*#${idx + 1}. Consignment:* ${c.consignmentNo}\n`;
      if (c.lotNo) text += `*Lot No:* ${c.lotNo}\n`;
      text += `*Marka:* ${c.marka || '-'}\n`;
      text += `*Cartons:* ${formatNumber(c.totalCtn)} CTN | *CBM:* ${formatNumber(c.cbm)}\n`;
      text += `*Current Status:* ${c.status}\n`;
      
      const checkpoints = (Object.entries(c.transitPoints || {}) as [string, { containerNo?: string; loadingDate?: string; dispatchDate?: string }][])
        .filter(([_, d]) => d?.containerNo || d?.loadingDate || d?.dispatchDate)
        .map(([tp, d]) => `${tp}: Cont. ${d.containerNo || 'Assigned'} (Disp: ${d.dispatchDate || d.loadingDate || 'Pending'})`);

      if (checkpoints.length > 0) {
        text += `*Transit Details:* ${checkpoints.join(' | ')}\n`;
      }
      text += `\n`;
    });

    text += `------------------------------------\n`;
    text += `For inquiries, contact ADO Bishal Support. Safe and prompt cargo delivery from China to Nepal! 🚚✨`;
    return text;
  };

  const handleCopyWhatsApp = (clientName: string) => {
    const msg = generateWhatsAppMessage(clientName);
    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-500 font-medium text-sm">Loading Client Directory...</p>
      </div>
    );
  }

  // If a client is selected, show their DEDICATED FULL-PAGE CONSIGNMENTS EXCEL SPREADSHEET!
  if (selectedClient) {
    const q = searchQuery.trim().toLowerCase();
    const rowMatchesQuery = (c: Consignment) => {
      if (!q) return false;
      const hit = (v?: string) => !!v && v.toLowerCase().includes(q);
      const containerHit = Object.values(c.transitPoints || {}).some((tp: any) => hit(tp?.containerNo));
      return hit(c.consignmentNo) || hit(c.marka) || hit(c.lotNo) || hit(c.container) || hit(c.destination) || hit(c.status) || containerHit;
    };
    const rawClientData = data.filter(c => (c.clientName || 'Unknown Client').trim() === selectedClient);
    // Whatever the user searched for is surfaced at the very top; everything else follows in its original order.
    const matchedRows = rawClientData.filter(rowMatchesQuery);
    const clientData = matchedRows.length > 0
      ? [...matchedRows, ...rawClientData.filter(c => !rowMatchesQuery(c))]
      : rawClientData;
    const clientInfo = clientStats.find(c => c.name === selectedClient);


    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Dedicated Client Header */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedClient(null)}
              className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl border border-slate-300 hover:border-blue-300 transition-all flex items-center space-x-2 font-bold text-sm shadow-xs cursor-pointer"
              title="Return to Client Directory"
            >
              <ArrowLeft size={18} />
              <span>Back to Directory</span>
            </button>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Directory</span>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Consignments Ledger
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center space-x-3">
                <span className="text-blue-900 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">{selectedClient}</span>
              </h2>
            </div>
          </div>

          {/* Actions & Badge */}
          <div className="flex flex-wrap items-center gap-3">
            {clientInfo && (
              <>
                <button
                  onClick={() => exportClientLedgerToExcel(selectedClient, clientData)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Export this client's specific statement to Excel (.xls)"
                >
                  <Download size={15} />
                  <span>Export Excel Statement (.xls)</span>
                </button>

                <button
                  onClick={() => setWhatsAppModalClient(selectedClient)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Generate ready-to-send WhatsApp summary for this client"
                >
                  <MessageSquare size={15} />
                  <span>WhatsApp Summary</span>
                </button>

                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-right font-mono shadow-xs">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">Total Consignments</span>
                  <span className="text-sm font-black text-amber-300">
                    {clientInfo.totalShipments} {clientInfo.totalShipments === 1 ? 'Shipment' : 'Shipments'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {matchedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">
            <Search size={14} />
            <span>
              {matchedRows.length} record{matchedRows.length > 1 ? 's' : ''} matching
              <span className="mx-1 rounded bg-amber-200 px-1.5 py-0.5 font-mono">{searchQuery.trim()}</span>
              pinned to the top of the ledger.
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="ml-auto rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 cursor-pointer"
            >
              Show original order
            </button>
          </div>
        )}

        {/* Full Excel Spreadsheet Table for Client with all details */}

        <ExcelTable
          data={clientData}
          clientName={selectedClient}
          isClientView={true}
          title={`${selectedClient} - Consignment Ledger`}
          subtitle={`All consignment records and transit details for ${selectedClient}`}
          filenamePrefix={`Statement_${selectedClient.replace(/\s+/g, '_')}`}
          onEdit={setEditingConsignment}
          onDelete={handleDelete}
          onInlineUpdate={handleEditSave}
          showActions={true}
        />

        {/* Individual Edit Modal */}
        {editingConsignment && (
          <EditConsignmentModal
            consignment={editingConsignment}
            onClose={() => setEditingConsignment(null)}
            onSave={handleEditSave}
          />
        )}

        {/* WhatsApp Summary Modal */}
        {whatsAppModalClient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 bg-emerald-700 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2.5">
                  <MessageSquare size={20} />
                  <h3 className="font-bold text-base">WhatsApp Client Dispatch Summary</h3>
                </div>
                <button 
                  onClick={() => setWhatsAppModalClient(null)}
                  className="p-1 hover:bg-emerald-800 rounded-full text-white/80 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50">
                <p className="text-xs text-slate-600 font-medium">
                  Copy and paste this formatted message directly into WhatsApp or SMS to update <strong>{whatsAppModalClient}</strong>:
                </p>
                <div className="bg-white p-4 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {generateWhatsAppMessage(whatsAppModalClient)}
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
                <button
                  onClick={() => setWhatsAppModalClient(null)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => handleCopyWhatsApp(whatsAppModalClient)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
                >
                  {copiedMsg ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedMsg ? 'Copied to Clipboard!' : 'Copy WhatsApp Text'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ROW-WISE CLIENT DIRECTORY DISPLAY (Clean, highlighted client rows with search for Marka, Consignment No, Container, etc.)
  return (
    <div className="space-y-5 w-full">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-inner shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Client Directory</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Click any client row to view all related consignments and cargo records
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold uppercase text-blue-700 block">Total Clients</span>
            <span className="text-base font-black text-blue-900">{clientStats.length} Registered</span>
          </div>
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Advanced Multi-Field Search Input Bar */}
      <form 
        onSubmit={handleExecuteSearch}
        className="bg-white p-3 sm:p-4 rounded-xl border border-slate-300 shadow-sm flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Client Name, Marka (e.g. ET-88), Consignment #, Container #, or Lot #..."
            className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          <Search size={16} />
          <span>Search</span>
        </button>
      </form>

      {/* Search status notification if searching */}
      {searchQuery.trim() && (
        <div className="px-1 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>
            Found <strong>{filteredClientsWithMatches.length}</strong> client{filteredClientsWithMatches.length === 1 ? '' : 's'} matching "<strong>{searchQuery}</strong>"
          </span>
          {filteredClientsWithMatches.length === 1 && (
            <span className="text-blue-600 font-bold">
              Press Enter or click Search to open this client directly
            </span>
          )}
        </div>
      )}

      {/* ROW FORM CLIENT LIST (Highlighted Client Name + Match Badges + Total Shipments) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden divide-y divide-slate-200">
        {filteredClientsWithMatches.map(({ client, matches }) => {
          return (
            <div
              key={client.name}
              onClick={() => setSelectedClient(client.name)}
              className="p-4 sm:px-6 hover:bg-blue-50/70 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left Side: Client Avatar, Highlighted Name & Matched Attribute Badges */}
              <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                {/* Visual Avatar Badge */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  {client.name.charAt(0).toUpperCase()}
                </div>

                {/* Highlighted Client Name & Match Highlights */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base sm:text-lg font-black text-blue-900 group-hover:text-blue-700 tracking-tight truncate">
                      {client.name}
                    </h3>
                  </div>

                  {/* Matched Details Badges (Marka, Consignment No, Container, Lot) */}
                  {matches && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {matches.matchedMarkas.map(m => (
                        <span key={m} className="inline-flex items-center space-x-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                          <Tag size={10} />
                          <span>Marka: {m}</span>
                        </span>
                      ))}
                      {matches.matchedConsignmentNos.map(cn => (
                        <span key={cn} className="inline-flex items-center space-x-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          <Package size={10} />
                          <span>Consignment: {cn}</span>
                        </span>
                      ))}
                      {matches.matchedContainers.map(cont => (
                        <span key={cont} className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <Truck size={10} />
                          <span>Cont: {cont}</span>
                        </span>
                      ))}
                      {matches.matchedLotNos.map(lot => (
                        <span key={lot} className="inline-flex items-center space-x-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                          <span>Lot #{lot}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Total Consignments Count & Action Indicator */}
              <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Total Shipments Badge */}
                <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 group-hover:bg-blue-100/80 border border-slate-200 group-hover:border-blue-300 transition-colors text-right">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-blue-950">
                    {client.totalShipments} {client.totalShipments === 1 ? 'Shipment' : 'Shipments'}
                  </div>
                </div>

                {/* Open Action Chevron */}
                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-500 flex items-center justify-center transition-colors">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          );
        })}

        {filteredClientsWithMatches.length === 0 && (
          <div className="py-16 text-center text-slate-500 bg-white space-y-3">
            <Building2 size={36} className="mx-auto text-slate-400" />
            <p className="font-bold text-slate-700 text-base">No client found matching "{searchQuery}"</p>
            <p className="text-xs text-slate-400">
              Try searching by client name, marka marking code, consignment number, container number, or lot number.
            </p>
          </div>
        )}
      </div>

      {/* WhatsApp Summary Modal */}
      {whatsAppModalClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-emerald-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5">
                <MessageSquare size={20} />
                <h3 className="font-bold text-base">WhatsApp Client Dispatch Summary</h3>
              </div>
              <button 
                onClick={() => setWhatsAppModalClient(null)}
                className="p-1 hover:bg-emerald-800 rounded-full text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 bg-slate-50">
              <p className="text-xs text-slate-600 font-medium">
                Copy and paste this formatted message directly into WhatsApp or SMS to update <strong>{whatsAppModalClient}</strong>:
              </p>
              <div className="bg-white p-4 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                {generateWhatsAppMessage(whatsAppModalClient)}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                onClick={() => setWhatsAppModalClient(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleCopyWhatsApp(whatsAppModalClient)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
              >
                {copiedMsg ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedMsg ? 'Copied to Clipboard!' : 'Copy WhatsApp Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
