import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, Loader2, Sparkles, User, Copy, Check, 
  Trash2, Download, MessageSquare, AlertTriangle, 
  Package, Truck, FileSpreadsheet, RefreshCw, ChevronRight
} from 'lucide-react';
import { api } from '../api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export default function AIAssistantView() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1',
      role: 'ai', 
      content: "Namaste! I am **ADO's Assistant**, the official AI logistics officer for ADO International Transport Nepal.\n\nI have complete real-time intelligence over all China warehouse receipts (Guangzhou & Yiwu), Tibetan highway transit checkpoints (Lhasa, Nyalam, Kerung, Tatopani, Rasuwa), container loading schedules, Lot Numbers, and client ledgers.\n\nAsk me anything regarding this app's dashboard, warehouse stock, container shipments, or client updates!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    {
      title: "App Overview & Features",
      icon: Sparkles,
      prompt: "Give me an overall breakdown and explanation of all features and capabilities in this ADO International Transport logistics application."
    },
    {
      title: "Warehouse Inventory Summary",
      icon: Package,
      prompt: "Provide a detailed comparison of Guangzhou vs Yiwu warehouse stock, total cartons, Lot Numbers, and total CBM awaiting dispatch."
    },
    {
      title: "Transit Checkpoints & Containers",
      icon: AlertTriangle,
      prompt: "Identify all active containers and dispatch schedules across Lhasa, Nyalam, Kerung, Tatopani, and Rasuwa checkpoints."
    },
    {
      title: "WhatsApp Client Update",
      icon: MessageSquare,
      prompt: "Draft a ready-to-send WhatsApp transit status update message for a client with active cargo on the Kerung route."
    },
    {
      title: "Top Clients by Volume",
      icon: Truck,
      prompt: "List our top clients by total CBM volume, registered Markas, and carton count from the current shipment database."
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const userQuery = textToSend || input.trim();
    if (!userQuery || loading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const reply = await api.chat(userQuery);
      const aiMessage: Message = {
        id: String(Date.now() + 1),
        role: 'ai',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        role: 'ai',
        content: `⚠️ Could not complete request: ${err.message || 'Server error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm('Clear entire conversation history?')) {
      setMessages([
        { 
          id: '1',
          role: 'ai', 
          content: "Conversation history cleared. Ready for your next query!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleExportChat = () => {
    const text = messages.map(m => `[${m.timestamp}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADOs_Assistant_Chat_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simple Markdown renderer for tables, bold text, bullet points
  const renderFormattedContent = (content: string) => {
    // Check if content has markdown table
    if (content.includes('|') && content.includes('\n')) {
      const lines = content.split('\n');
      const tableLines: string[] = [];
      const nonTableBefore: string[] = [];
      const nonTableAfter: string[] = [];
      let inTable = false;
      let tableFinished = false;

      for (const line of lines) {
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          inTable = true;
          tableLines.push(line);
        } else if (inTable) {
          tableFinished = true;
          nonTableAfter.push(line);
        } else {
          nonTableBefore.push(line);
        }
      }

      if (tableLines.length >= 2) {
        // Parse table
        const rows = tableLines.filter(l => !l.includes('---')).map(l => 
          l.split('|').slice(1, -1).map(c => c.trim())
        );
        const headers = rows[0] || [];
        const bodyRows = rows.slice(1);

        return (
          <div className="space-y-3">
            {nonTableBefore.length > 0 && (
              <div className="whitespace-pre-wrap">{nonTableBefore.join('\n')}</div>
            )}
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-300 shadow-xs">
              <table className="w-full text-center border-collapse border border-slate-300 text-xs">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="border border-slate-600 p-2 text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {bodyRows.map((r, ri) => (
                    <tr key={ri} className="hover:bg-blue-50/50">
                      {r.map((cell, ci) => (
                        <td key={ci} className="border border-slate-300 p-2 text-center">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nonTableAfter.length > 0 && (
              <div className="whitespace-pre-wrap">{nonTableAfter.join('\n')}</div>
            )}
          </div>
        );
      }
    }

    return <div className="whitespace-pre-wrap leading-relaxed">{content}</div>;
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <Sparkles className="text-white" size={22} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black tracking-tight text-white">ADO's Assistant</h2>
              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                AI Logistics Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Grounded in China-Tibet-Nepal live freight database
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportChat}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            title="Download Transcript"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleClearChat}
            className="p-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700"
            title="Clear Chat"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center space-x-2 overflow-x-auto shrink-0 custom-scrollbar">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 flex items-center space-x-1">
          <Sparkles size={12} className="text-blue-600" />
          <span>Quick Actions:</span>
        </span>
        {quickPrompts.map((qp, index) => {
          const Icon = qp.icon;
          return (
            <button
              key={index}
              onClick={() => handleSend(qp.prompt)}
              disabled={loading}
              className="px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-bold border border-slate-300 hover:border-blue-300 transition-all flex items-center space-x-1.5 shrink-0 shadow-2xs disabled:opacity-50"
            >
              <Icon size={13} className="text-blue-600" />
              <span>{qp.title}</span>
            </button>
          );
        })}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50 custom-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && (
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm font-bold text-sm">
                <Bot size={18} />
              </div>
            )}

            <div className={`max-w-[85%] sm:max-w-[75%] space-y-1.5`}>
              <div 
                className={`p-4 rounded-2xl text-sm shadow-sm relative group ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-xs font-medium' 
                    : 'bg-white border border-slate-300 text-slate-900 rounded-tl-xs'
                }`}
              >
                {renderFormattedContent(m.content)}

                {/* Copy button for AI responses */}
                {m.role === 'ai' && (
                  <button
                    onClick={() => copyToClipboard(m.id, m.content)}
                    className="absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-slate-200 shadow-2xs"
                    title="Copy response to clipboard"
                  >
                    {copiedId === m.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                )}
              </div>

              <div className={`text-[10px] text-slate-400 font-mono ${m.role === 'user' ? 'text-right' : 'text-left pl-1'}`}>
                {m.role === 'user' ? 'Staff Admin' : "ADO's Assistant"} • {m.timestamp}
              </div>
            </div>

            {m.role === 'user' && (
              <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 ml-3 mt-1 shadow-sm font-bold text-xs">
                <User size={18} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mr-3 mt-1 shadow-sm">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-slate-300 p-4 rounded-2xl rounded-tl-xs shadow-sm flex items-center space-x-3">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <span className="text-slate-600 text-sm font-medium">ADO's Assistant is analyzing cargo database...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-center space-x-3 w-full relative">
          <input
            type="text"
            placeholder="Ask ADO's Assistant about consignments, markas, transit status, or client drafts..."
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 py-3.5 pl-5 pr-14 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm font-medium transition-all shadow-inner"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading} 
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Send query"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
