import React, { useMemo, useState } from 'react';
import { 
  Package, Truck, CheckCircle, Search, Menu, X, 
  Bot, MapPin, ClipboardList, Layers, 
  BarChart3, StickyNote, LogOut, ShieldCheck
} from 'lucide-react';
import adoLogoFull from '../assets/ado-logo-full.png';
import type { View } from '../views';
import Dashboard from './Dashboard';
import ConsignmentsView from './ConsignmentsView';
import ClientsView from './ClientsView';
import InventoryView from './InventoryView';
import AIAssistantView from './AIAssistantView';
import LotManagerView from './LotManagerView';
import AnalyticsView from './AnalyticsView';
import NotesView from './NotesView';
import StaffAdminView from './StaffAdminView';
import { useAuthz } from '@/hooks/useAuthz';


export default function AppShell({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => void }) {
  const { isAdmin, canView, loading: authzLoading } = useAuthz();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null);

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: Package },
    { id: 'inventory', label: 'Inventory Stock', icon: ClipboardList },
    { id: 'guangzhou', label: 'Guangzhou Warehouse', icon: MapPin },
    { id: 'yiwu', label: 'Yiwu Warehouse', icon: MapPin },
    { id: 'lots', label: 'Lot Batch Manager', icon: Layers },
    { id: 'clients', label: 'Client Directory', icon: Truck },
    { id: 'notes', label: 'Notes & Voice Memos', icon: StickyNote },
    { id: 'analytics', label: 'Freight Analytics', icon: BarChart3 },
    { id: 'ai', label: "ADO's Assistant", icon: Bot },
    { id: 'staff', label: 'Staff & Permissions', icon: ShieldCheck },
  ] as const;

  const navItems = useMemo(
    () =>
      allNavItems.filter((item) =>
        item.id === 'staff' ? isAdmin : canView(item.id),
      ),
    [isAdmin, canView],
  );

  const activeView: View = navItems.some((n) => n.id === currentView)
    ? currentView
    : (navItems[0]?.id ?? 'dashboard');


  const renderView = () => {
    if (authzLoading) {
      return (
        <div className="p-8 text-xs font-bold text-slate-500">Checking your access…</div>
      );
    }
    if (navItems.length === 0) {
      return (
        <div className="rounded-2xl border border-sky-200 bg-white p-8 text-center">
          <h2 className="text-sm font-extrabold text-slate-900">No modules assigned yet</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ask your administrator to grant you access to the modules you need.
          </p>
        </div>
      );
    }
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard 
            onViewChange={setCurrentView} 
            onClientSelect={(c) => { 
              setSelectedClientFilter(c); 
              setCurrentView('guangzhou'); 
            }} 
          />
        );
      case 'inventory':
        return <InventoryView />;
      case 'guangzhou':
        return (
          <ConsignmentsView 
            origin="Guangzhou" 
            clientFilter={selectedClientFilter} 
            onClearClientFilter={() => setSelectedClientFilter(null)} 
          />
        );
      case 'yiwu':
        return (
          <ConsignmentsView 
            origin="Yiwu" 
            clientFilter={selectedClientFilter} 
            onClearClientFilter={() => setSelectedClientFilter(null)} 
          />
        );
      case 'lots':
        return <LotManagerView />;
      case 'clients':
        return (
          <ClientsView 
            onClientSelect={(c) => { 
              setSelectedClientFilter(c); 
              setCurrentView('guangzhou'); 
            }} 
          />
        );
      case 'notes':
        return <NotesView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'ai':
        return <AIAssistantView />;
      case 'staff':
        return <StaffAdminView />;
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    const item = navItems.find(n => n.id === activeView);
    return item ? item.label : 'Dashboard';
  };


  return (
    <div className="flex h-screen w-full overflow-hidden bg-sky-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 bg-white text-slate-700 w-64 z-20 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-sky-200 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Header */}
        <div className="p-5 border-b border-sky-100 bg-sky-50/70 relative">
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1"
          >
            <X size={18} />
          </button>
          <div className="flex flex-col items-center text-center space-y-2">
            <img
              src={adoLogoFull}
              alt="ADO International"
              className="h-20 w-auto max-w-full object-contain"
            />
            <span className="text-[11px] font-extrabold text-sky-800 tracking-wide leading-tight">
              ADO International Transport Nepal
            </span>
          </div>
        </div>


        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 custom-scrollbar overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  if (item.id !== 'guangzhou' && item.id !== 'yiwu') {
                    setSelectedClientFilter(null);
                  }
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive 
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' 
                    : 'text-slate-600 hover:text-sky-800 hover:bg-sky-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={17} className={isActive ? 'text-white' : 'text-sky-500'} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'ai' && (
                  <span className="text-[9px] font-black bg-sky-500 text-white px-1.5 py-0.5 rounded-full uppercase">
                    AI
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-3.5 mt-auto border-t border-sky-100 bg-sky-50/70">
          <div className="bg-white p-3 rounded-xl flex items-center space-x-3 border border-sky-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-200 shrink-0 flex items-center justify-center text-sky-700 font-black text-xs">
              AB
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">{userEmail || 'ADO Bishal Logistics'}</div>
              <button
                onClick={onSignOut}
                className="text-[10px] text-slate-500 hover:text-sky-700 font-medium flex items-center space-x-1"
              >
                <LogOut size={11} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-sky-200 px-6 flex items-center justify-between z-10 shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
                {getHeaderTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Kathmandu HQ Active</span>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 bg-sky-50 custom-scrollbar">
          <div className="w-full min-w-0">
            {renderView()}
          </div>


        </main>
      </div>
    </div>
  );
}
