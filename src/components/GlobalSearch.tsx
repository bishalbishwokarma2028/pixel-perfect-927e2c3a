import React, { useState, useEffect, useMemo } from 'react';
import { Search, SearchIcon, MapPin, Truck } from 'lucide-react';
import { Consignment } from '../types';

export default function GlobalSearch({ data, onClientSelect }: { data: Consignment[], onClientSelect: (client: string) => void }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return data.filter(c => 
      c.consignmentNo.toLowerCase().includes(q) ||
      c.marka.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, data]);

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 border border-slate-200/60 w-full transition-all duration-300 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-inner">
        <span className="text-slate-400 mr-2 shrink-0"><SearchIcon size={16} className="transition-colors" /></span>
        <input 
          type="text" 
          placeholder="Search Consignment, Marka or Client..."
          className="bg-transparent border-none outline-none text-sm w-full text-slate-900 placeholder:text-slate-400 font-medium"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        />
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-100 max-h-96 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No results found for "{query}"</div>
          ) : (
            <ul className="py-2">
              {results.map(res => (
                <li key={res.id} className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                    onClick={() => {
                        onClientSelect(res.clientName);
                        setQuery('');
                    }}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-800 text-sm">{res.consignmentNo}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{res.origin}</span>
                  </div>
                  <div className="text-sm text-slate-600 flex items-center space-x-2">
                    <span>{res.clientName}</span>
                    <span className="text-slate-300">•</span>
                    <span>Marka: {res.marka}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 flex items-center space-x-4">
                     <div className="flex items-center space-x-1">
                       <MapPin size={12} /> <span>{res.destination}</span>
                     </div>
                     <div className="flex items-center space-x-1 text-amber-600">
                       <Truck size={12} /> <span>{res.status}</span>
                     </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
