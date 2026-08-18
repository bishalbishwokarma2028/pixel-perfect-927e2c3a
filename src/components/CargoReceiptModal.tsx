import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Consignment, TRANSIT_POINTS } from '../types';
import { formatNumber } from '../lib/utils';
import { 
  X, Printer, Check, 
  MapPin, Truck, Calendar, User, Package, Scale, 
  Layers, ShieldCheck, Tag, Download, ImageIcon, Loader2, Sparkles
} from 'lucide-react';

interface CargoReceiptModalProps {
  consignment: Consignment | null;
  onClose: () => void;
  onOpenNotesWithConsignment?: (consignment: Consignment) => void;
}

export default function CargoReceiptModal({
  consignment,
  onClose,
  onOpenNotesWithConsignment,
}: CargoReceiptModalProps) {
  const receiptCardRef = useRef<HTMLDivElement>(null);
  const [copiedType, setCopiedType] = useState<'image' | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!consignment) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
      setCopiedType(null);
    }, 4000);
  };

  // 1. PRINT HANDLER
  const handlePrint = () => {
    if (!receiptCardRef.current) {
      window.print();
      return;
    }

    try {
      // Create a dedicated clean popup window for printing
      const printWindow = window.open('', '_blank', 'width=850,height=900');
      if (printWindow) {
        const cardHtml = receiptCardRef.current.innerHTML;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Cargo Receipt - ${consignment.consignmentNo} (${consignment.marka || 'Cargo'})</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                body { 
                  background-color: #ffffff; 
                  padding: 24px; 
                  margin: 0;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                @media print {
                  @page { size: A4 portrait; margin: 12mm; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              <div style="max-width: 800px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px;">
                ${cardHtml}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  }, 400);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    } catch (err) {
      console.warn('Popup print blocked by browser, falling back to window.print():', err);
    }

    // Direct fallback
    window.print();
  };

  // 2. COPY AS IMAGE (Native Image Blob to Clipboard)
  const handleCopyImage = async () => {
    if (!receiptCardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2, // 2x crisp resolution for retina screens, WhatsApp & WeChat
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsCapturing(false);
          showToast('Failed to generate image');
          return;
        }

        let clipboardWritten = false;

        // Try writing directly to system clipboard as image/png
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          try {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            clipboardWritten = true;
            setCopiedType('image');
            showToast('✓ Receipt Image copied to clipboard! Paste directly (Ctrl+V) into WhatsApp, Word, or chats.');
          } catch (clipErr) {
            console.warn('Clipboard image write restricted by browser sandbox, falling back to direct save:', clipErr);
          }
        }

        // If clipboard write is restricted by iframe/browser security policies, save PNG file automatically
        if (!clipboardWritten) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Receipt_${consignment.consignmentNo}_${(consignment.marka || 'Cargo').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          setCopiedType('image');
          showToast('Receipt saved as PNG image to your Downloads!');
        }

        setIsCapturing(false);
      }, 'image/png', 1.0);

    } catch (err) {
      console.error('Error generating receipt image:', err);
      setIsCapturing(false);
      showToast('Could not capture receipt image');
    }
  };

  // 3. SAVE PNG FILE HANDLER
  const handleDownloadImage = async () => {
    if (!receiptCardRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const canvas = await html2canvas(receiptCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Receipt_${consignment.consignmentNo}_${(consignment.marka || 'Cargo').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsCapturing(false);
      showToast('✓ Receipt PNG image saved to Downloads!');
    } catch (err) {
      console.error('Download error:', err);
      setIsCapturing(false);
      showToast('Error saving PNG image');
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('deliver')) {
      return {
        bg: 'bg-emerald-600 text-white border-emerald-700',
        dot: 'bg-white'
      };
    }
    if (s.startsWith('at ')) {
      return {
        bg: 'bg-purple-600 text-white border-purple-700',
        dot: 'bg-purple-200'
      };
    }
    if (s.startsWith('on the way')) {
      return {
        bg: 'bg-amber-500 text-slate-950 border-amber-600',
        dot: 'bg-slate-900'
      };
    }
    return {
      bg: 'bg-blue-600 text-white border-blue-700',
      dot: 'bg-blue-200'
    };
  };

  const statusStyle = getStatusBadgeStyle(consignment.status);

  // Transit hub display labels
  const transitHubLabels: Record<string, string> = {
    LHASA: 'Lhasa Hub',
    NYLAM: 'Nyalam Hub',
    KERUNG: 'Kerung Border',
    TATOPANI: 'Tatopani Border',
    RASUWA: 'Rasuwa Border',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 flex flex-col justify-between overflow-hidden max-h-[96vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Header Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-inner">
              ADO
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black tracking-wider uppercase text-slate-100">
                  Cargo Receipt & Manifest
                </span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700">
                  {consignment.origin} Hub
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* PRIMARY: COPY AS IMAGE */}
            <button
              onClick={handleCopyImage}
              disabled={isCapturing}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              title="Copy receipt as an image graphic to paste directly into WhatsApp, Viber, WeChat, Word, etc."
            >
              {isCapturing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : copiedType === 'image' ? (
                <Check size={13} className="text-emerald-300" />
              ) : (
                <ImageIcon size={13} />
              )}
              <span>{isCapturing ? 'Capturing...' : copiedType === 'image' ? 'Image Copied!' : 'Copy Image'}</span>
            </button>

            {/* DOWNLOAD PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isCapturing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 border border-slate-700 disabled:opacity-50 cursor-pointer"
              title="Download crisp PNG image file to device"
            >
              <Download size={13} />
              <span>Save PNG</span>
            </button>

            {/* PRINT */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
              title="Print official cargo receipt"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            {/* CLOSE */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Floating Toast Notification Bar */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center space-x-2 text-center shrink-0 shadow-inner">
            <Check size={15} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 
          MODAL BODY & CAPTURABLE RECEIPT CARD:
          Clean bordered receipt card ready for html2canvas capture or print
        */}
        <div 
          ref={receiptCardRef}
          data-receipt-card="true"
          className="p-4 sm:p-5 space-y-3 text-slate-800 font-sans bg-white overflow-hidden"
        >
          {/* Header Strip inside image/print */}
          <div className="border-b-2 border-slate-900 pb-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm tracking-wider">
                ADO
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight uppercase leading-tight">
                  ADO International Transport Nepal
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Cross-Border Cargo Manifest & Official Consignment Slip
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Hub Origin</span>
              <span className="text-xs font-black text-blue-700 font-mono">
                {consignment.origin} Warehouse
              </span>
            </div>
          </div>
          
          {/* TOP TIER: 4 KEY METRIC CARDS (Marka, Consignment No, Status, Client) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            
            {/* 1. HIGHLIGHTED MARKA (MARK) */}
            <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-indigo-900 tracking-wider flex items-center space-x-1">
                  <Tag size={11} className="text-indigo-600" />
                  <span>Marka (Mark)</span>
                </span>
                {consignment.lotNo && (
                  <span className="text-[9px] font-mono font-bold bg-indigo-200/70 text-indigo-900 px-1 py-0.2 rounded">
                    Lot #{consignment.lotNo}
                  </span>
                )}
              </div>
              <div className="my-1">
                <p className="text-base sm:text-lg font-black font-mono text-indigo-950 tracking-wide truncate" title={consignment.marka}>
                  {consignment.marka || '—'}
                </p>
              </div>
              <span className="text-[9px] font-semibold text-indigo-700">
                Marking Code
              </span>
            </div>

            {/* 2. HIGHLIGHTED CONSIGNMENT NO */}
            <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-blue-900 tracking-wider flex items-center space-x-1">
                  <Package size={11} className="text-blue-600" />
                  <span>Consignment No</span>
                </span>
                <span className="text-[9px] font-mono text-blue-700 font-bold">
                  {consignment.date}
                </span>
              </div>
              <div className="my-1">
                <p className="text-base sm:text-lg font-black font-mono text-blue-950 tracking-wide truncate" title={consignment.consignmentNo}>
                  {consignment.consignmentNo}
                </p>
              </div>
              <span className="text-[9px] font-semibold text-blue-700">
                Booking Date: {consignment.date || '—'}
              </span>
            </div>

            {/* 3. HIGHLIGHTED STATUS */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1">
                  <Truck size={11} className="text-slate-600" />
                  <span>Current Status</span>
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">
                  Active
                </span>
              </div>
              <div className="my-1">
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-black border ${statusStyle.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} inline-block`} />
                  <span className="truncate">{consignment.status}</span>
                </span>
              </div>
              <span className="text-[9px] font-semibold text-slate-500 truncate">
                Updated: {new Date(consignment.updatedAt || consignment.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* 4. HIGHLIGHTED CLIENT / CONSIGNEE INFORMATION */}
            <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-amber-900 tracking-wider flex items-center space-x-1">
                  <User size={11} className="text-amber-700" />
                  <span>Consignee</span>
                </span>
                <span className="text-[9px] font-bold text-amber-800 flex items-center space-x-0.5">
                  <MapPin size={9} />
                  <span className="truncate max-w-[65px]">{consignment.destination || 'Nepal'}</span>
                </span>
              </div>
              <div className="my-1">
                <p className="text-sm sm:text-base font-black text-amber-950 truncate" title={consignment.clientName || 'Unassigned'}>
                  {consignment.clientName || 'Unassigned Client'}
                </p>
              </div>
              <span className="text-[9px] font-semibold text-amber-800 truncate">
                Dest: <strong className="text-slate-900">{consignment.destination || 'Kathmandu, Nepal'}</strong>
              </span>
            </div>

          </div>

          {/* MIDDLE TIER: CARGO SPECIFICATIONS (CTN, CBM, WEIGHT) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider flex items-center space-x-1">
                <Layers size={11} className="text-slate-600" />
                <span>Cargo Volume & Weight Specifications</span>
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-medium">
                Standard Verified Cargo Metric
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Total Cartons */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-xs">
                <span className="text-[9px] font-bold uppercase text-slate-500 block">
                  Total Cartons
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-slate-900">
                  {formatNumber(consignment.totalCtn)}
                  <span className="text-[10px] font-bold text-slate-500 ml-1">CTN</span>
                </p>
              </div>

              {/* Volume CBM */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-xs">
                <span className="text-[9px] font-bold uppercase text-slate-500 block">
                  Cubic Volume
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-blue-700">
                  {formatNumber(consignment.cbm)}
                  <span className="text-[10px] font-bold text-blue-500 ml-1">CBM</span>
                </p>
              </div>

              {/* Gross Weight KG */}
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-center shadow-xs">
                <span className="text-[9px] font-bold uppercase text-slate-500 block">
                  Gross Weight
                </span>
                <p className="text-base sm:text-lg font-black font-mono text-emerald-700">
                  {formatNumber(consignment.gw)}
                  <span className="text-[10px] font-bold text-emerald-600 ml-1">KG</span>
                </p>
              </div>
            </div>
          </div>

          {/* TRANS-HIMALAYAN TRANSIT CORRIDOR CHECKPOINTS */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-black uppercase text-slate-600 tracking-wider flex items-center space-x-1">
                <Truck size={11} className="text-slate-600" />
                <span>Transit Corridor (Lhasa → Nyalam → Border Hubs)</span>
              </span>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                5 Corridor Checkpoints
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {TRANSIT_POINTS.map(hub => {
                const data = consignment.transitPoints?.[hub];
                const hasContainer = Boolean(data?.containerNo);
                const hasDate = Boolean(data?.dispatchDate || data?.loadingDate);
                const isPassed = hasContainer || hasDate;

                return (
                  <div 
                    key={hub} 
                    className={`p-2 rounded-xl border text-left flex flex-col justify-between ${
                      isPassed 
                        ? 'bg-blue-50/60 border-blue-300' 
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-black text-slate-800 truncate">
                          {transitHubLabels[hub] || hub}
                        </span>
                        {isPassed ? (
                          <span className="w-3 h-3 rounded-full bg-blue-600 text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                            ✓
                          </span>
                        ) : (
                          <span className="w-3 h-3 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[7px] shrink-0">
                            •
                          </span>
                        )}
                      </div>

                      {/* Container Number */}
                      <div className="mt-0.5">
                        <span className="text-[8px] uppercase font-bold text-slate-400 block">Cont. No:</span>
                        <div className="text-[10px] font-mono font-black text-slate-900 truncate">
                          {data?.containerNo ? (
                            <span className="text-blue-800 bg-white px-1 py-0.2 rounded border border-blue-200 inline-block font-bold">
                              {data.containerNo}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dispatch Date */}
                    <div className="mt-1 pt-1 border-t border-slate-200">
                      <span className="text-[8px] uppercase font-bold text-slate-400 block">Dispatch:</span>
                      <span className="text-[9px] font-mono font-medium text-slate-700 truncate block">
                        {data?.dispatchDate || data?.loadingDate || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FULLY VISIBLE REMARKS SECTION & VERIFICATION SEAL */}
          <div className="pt-1.5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex-1 bg-amber-50/60 p-2 rounded-xl border border-amber-200 flex items-start space-x-2">
              <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider shrink-0 mt-0.5">
                Remarks:
              </span>
              <p className="text-xs text-slate-800 font-medium break-words leading-relaxed">
                {consignment.remarks ? consignment.remarks : 'No special remarks recorded.'}
              </p>
            </div>

            <div className="shrink-0 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              <div className="text-[9px] font-bold text-blue-950 leading-tight">
                <span>ADO Logistics Certified Slip</span>
                <div className="text-[8px] text-blue-600 font-mono">ID: {consignment.id}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Action Controls */}
        <div className="bg-slate-100 px-4 sm:px-5 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1.5">
            <Sparkles size={12} className="text-blue-600" />
            <span>Click <strong>"Copy Image"</strong> or <strong>"Save PNG"</strong> for WhatsApp/chats</span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenNotesWithConsignment && (
              <button
                type="button"
                onClick={() => {
                  onOpenNotesWithConsignment(consignment);
                  onClose();
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <span>Add Note</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
