import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { NoteItem } from '../types';
import { 
  StickyNote, Mic, MicOff, Image, Trash2, Plus, 
  Search, X, Check, Upload, Tag, RefreshCw, 
  Volume2, VolumeX, Sparkles, Clock, AlertCircle,
  FileText, Shield, Truck, Building2, Layers,
  Play, Pause, Pin, Copy, ExternalLink, Download,
  Maximize2
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const CATEGORIES = ['General', 'Customs', 'Urgent', 'Client', 'Transit', 'Warehouse'] as const;
const COLOR_THEMES = [
  { key: 'amber', label: 'Warm Amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', accent: 'bg-amber-500' },
  { key: 'blue', label: 'Ocean Blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-500' },
  { key: 'emerald', label: 'Forest Green', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'bg-emerald-500' },
  { key: 'rose', label: 'Coral Rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', accent: 'bg-rose-500' },
  { key: 'indigo', label: 'Indigo Violet', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', accent: 'bg-indigo-500' },
  { key: 'slate', label: 'Classic Slate', bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-900', accent: 'bg-slate-700' },
] as const;

// Standalone Custom Audio Player Component
function VoiceMemoPlayer({ audioUrl, duration }: { audioUrl: string; duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-sm flex items-center space-x-3 w-full">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          isPlaying 
            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
        title={isPlaying ? 'Pause Voice Memo' : 'Play Voice Memo'}
      >
        {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
      </button>

      {/* Track & Time */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-amber-400 font-bold flex items-center space-x-1">
            <Mic size={11} />
            <span>Voice Memo</span>
            {isPlaying && (
              <span className="flex items-center space-x-0.5 ml-1">
                <span className="w-1 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </span>
          <span className="text-slate-400 text-[10px]">
            {formatSecs(currentTime)} / {formatSecs(totalDuration || currentTime)}
          </span>
        </div>

        {/* Seek Bar */}
        <input
          type="range"
          min="0"
          max={totalDuration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </div>
    </div>
  );
}

export default function NotesView() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [onlyPinned, setOnlyPinned] = useState(false);

  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteItem['category']>('General');
  const [colorTheme, setColorTheme] = useState<NoteItem['colorTheme']>('amber');
  const [isPinned, setIsPinned] = useState(false);
  const [linkedConsignmentNo, setLinkedConsignmentNo] = useState('');
  const [linkedMarka, setLinkedMarka] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  
  // Voice Recording State (Direct Audio Recording)
  const [audioDataUrl, setAudioDataUrl] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);

  // Lightbox Modal for Full Image View
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Copied Toast feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const data = await api.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useRealtimeRefresh('notes', fetchNotes);

  // --- AUDIO RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType }) 
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAudioDataUrl(base64Audio);
          setAudioDuration(recordingSeconds);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting audio recording:', err);
      alert('Microphone access could not be established. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recording:', err);
      }
    }
  };

  const discardAudio = () => {
    setAudioDataUrl('');
    setAudioDuration(0);
    setRecordingSeconds(0);
  };

  // Image Upload Handling
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files[0]) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        handleImageFile(file);
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('General');
    setColorTheme('amber');
    setIsPinned(false);
    setLinkedConsignmentNo('');
    setLinkedMarka('');
    setImageUrl('');
    setAudioDataUrl('');
    setAudioDuration(0);
    setEditingNoteId(null);
    setIsCreating(false);
    if (isRecording) stopRecording();
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim() && !imageUrl && !audioDataUrl) return;

    try {
      const payload: Partial<NoteItem> = {
        title: title.trim() || (audioDataUrl ? 'Voice Memo' : 'Logistics Note'),
        content: content.trim(),
        category,
        colorTheme,
        isPinned,
        linkedConsignmentNo: linkedConsignmentNo.trim() || undefined,
        linkedMarka: linkedMarka.trim() || undefined,
        imageUrl: imageUrl || undefined,
        audioDataUrl: audioDataUrl || undefined,
        audioDuration: audioDuration || undefined,
      };

      if (editingNoteId) {
        const updated = await api.updateNote(editingNoteId, payload);
        setNotes(prev => prev.map(n => n.id === editingNoteId ? updated : n));
      } else {
        const created = await api.createNote(payload);
        setNotes(prev => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleEditClick = (note: NoteItem) => {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category || 'General');
    setColorTheme(note.colorTheme || 'amber');
    setIsPinned(Boolean(note.isPinned));
    setLinkedConsignmentNo(note.linkedConsignmentNo || '');
    setLinkedMarka(note.linkedMarka || '');
    setImageUrl(note.imageUrl || '');
    setAudioDataUrl(note.audioDataUrl || '');
    setAudioDuration(note.audioDuration || 0);
    setIsCreating(true);
  };

  const handleTogglePin = async (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedPinned = !note.isPinned;
    try {
      await api.updateNote(note.id, { isPinned: updatedPinned });
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, isPinned: updatedPinned } : n));
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const openDeleteConfirmation = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToDelete(note);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!noteToDelete) return;
    try {
      await api.deleteNote(noteToDelete.id);
      setNotes(prev => prev.filter(n => n.id !== noteToDelete.id));
      if (editingNoteId === noteToDelete.id) resetForm();
      setDeleteModalOpen(false);
      setNoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleCopyNote = (note: NoteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = `[${note.category}] ${note.title}\n\n${note.content || ''}${note.linkedConsignmentNo ? `\nConsignment: ${note.linkedConsignmentNo}` : ''}${note.linkedMarka ? `\nMarka: ${note.linkedMarka}` : ''}`;
    navigator.clipboard.writeText(fullText.trim());
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Urgent': return 'bg-red-500 text-white';
      case 'Customs': return 'bg-amber-500 text-white';
      case 'Transit': return 'bg-indigo-500 text-white';
      case 'Client': return 'bg-emerald-500 text-white';
      case 'Warehouse': return 'bg-blue-500 text-white';
      default: return 'bg-slate-700 text-white';
    }
  };

  const getThemeStyle = (theme?: string) => {
    const found = COLOR_THEMES.find(t => t.key === theme);
    return found || COLOR_THEMES[0];
  };

  // Filter and Sort: Pinned notes always at top
  const filteredNotes = notes
    .filter(n => {
      if (onlyPinned && !n.isPinned) return false;
      const matchesCat = selectedCategory === 'All' || n.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.linkedConsignmentNo && n.linkedConsignmentNo.toLowerCase().includes(q)) ||
        (n.linkedMarka && n.linkedMarka.toLowerCase().includes(q)) ||
        (n.audioTranscription && n.audioTranscription.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  return (
    <div className="space-y-5 w-full animate-in fade-in duration-200">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 border border-slate-800 shadow-xl p-6 md:p-7">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 left-1/3 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-900/40 shrink-0">
              <StickyNote size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Notes &amp; Voice Memos
              </h2>
              <p className="text-xs md:text-sm text-slate-400 font-medium mt-1 max-w-xl">
                Record voice memos for drivers and warehouse teams, attach cargo photos, and keep clearance notes linked to consignments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                if (isCreating) resetForm();
                else {
                  resetForm();
                  setIsCreating(true);
                }
              }}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-900/40 transition-all flex items-center space-x-2"
            >
              {isCreating ? <X size={16} /> : <Plus size={16} />}
              <span>{isCreating ? 'Close Note' : 'New Note / Voice Memo'}</span>
            </button>

            <button
              onClick={fetchNotes}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-colors"
              title="Refresh Notes"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative mt-6 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Memos', value: notes.length, icon: StickyNote, tone: 'text-white' },
            { label: 'Pinned', value: notes.filter(n => n.isPinned).length, icon: Pin, tone: 'text-amber-300' },
            { label: 'Voice Memos', value: notes.filter(n => n.audioDataUrl).length, icon: Mic, tone: 'text-rose-300' },
            { label: 'With Photos', value: notes.filter(n => n.imageUrl).length, icon: Image, tone: 'text-sky-300' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl bg-white/5 border border-white/10 px-3.5 py-3 backdrop-blur-xs"
            >
              <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <s.icon size={12} />
                <span>{s.label}</span>
              </div>
              <div className={`mt-1 text-xl font-black tracking-tight ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Creation / Edit Form Drawer */}
      {isCreating && (
        <form 
          onSubmit={handleSaveNote}
          onPaste={handlePaste}
          className="bg-white rounded-3xl border-2 border-amber-400 p-6 md:p-7 shadow-xl space-y-5 animate-in slide-in-from-top duration-200 relative overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sparkles size={18} className="text-amber-500" />
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingNoteId ? 'Edit Logistics Note & Voice Memo' : 'Create New Logistics Note / Voice Memo'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Category Selector */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-500">Category:</span>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as NoteItem['category'])}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Pin Toggle */}
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors flex items-center space-x-1.5 ${
                  isPinned 
                    ? 'bg-amber-100 text-amber-900 border-amber-300' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Pin size={13} className={isPinned ? 'fill-current' : ''} />
                <span>{isPinned ? 'Pinned to Top' : 'Pin Note'}</span>
              </button>
            </div>
          </div>

          {/* Title & Content */}
          <div className="space-y-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Note Title / Subject (e.g., Kerung Customs Clearance, Driver Dispatch Memo...)"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
            />

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              placeholder="Write detailed cargo instructions, container inspection remarks, client notes, or paste text/receipt image..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all custom-scrollbar"
            />
          </div>

          {/* Cargo Metadata Linking (Optional Marka / Consignment #) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Link Consignment No. (Optional)
              </label>
              <input
                type="text"
                value={linkedConsignmentNo}
                onChange={e => setLinkedConsignmentNo(e.target.value)}
                placeholder="e.g. GZ-1001 or YW-2001"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Link Marka / Brand Code (Optional)
              </label>
              <input
                type="text"
                value={linkedMarka}
                onChange={e => setLinkedMarka(e.target.value)}
                placeholder="e.g. ABC-1 or KR-99"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Voice Memo & Photo Attachment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Voice Memo Recording Box (Requested: "Start speaking" option, record audio to listen) */}
            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Mic size={16} className="text-amber-600" />
                    <span>Voice Memo (Record & Store Audio)</span>
                  </span>

                  {isRecording && (
                    <span className="text-xs font-mono font-bold text-red-600 bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      <span>Recording: {formatTimer(recordingSeconds)}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Records your voice directly so team members and drivers can play and listen to what was said.
                </p>
              </div>

              {/* Action Buttons & Player */}
              <div className="space-y-2 pt-2">
                {!audioDataUrl && !isRecording && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-sm"
                  >
                    <Mic size={16} />
                    <span>Start Speaking</span>
                  </button>
                )}

                {isRecording && (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-red-600/20 animate-pulse"
                  >
                    <MicOff size={16} />
                    <span>Stop Recording ({formatTimer(recordingSeconds)})</span>
                  </button>
                )}

                {audioDataUrl && (
                  <div className="space-y-2">
                    <VoiceMemoPlayer audioUrl={audioDataUrl} duration={audioDuration} />
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
                        <Check size={13} />
                        <span>Voice Memo Saved</span>
                      </span>
                      <button
                        type="button"
                        onClick={discardAudio}
                        className="text-red-600 hover:underline text-xs font-bold"
                      >
                        Discard / Re-record
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Photo / Receipt Attachment Box */}
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Image size={16} className="text-blue-500" />
                  <span>Cargo Photo / Receipt Attachment</span>
                </span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-red-600 hover:underline font-bold"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-300 max-h-36 bg-slate-900 flex items-center justify-center group">
                  <img src={imageUrl} alt="Attached Receipt" className="h-32 object-contain" />
                  <button
                    type="button"
                    onClick={() => setLightboxImage(imageUrl)}
                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-1.5 text-xs font-bold transition-opacity"
                  >
                    <Maximize2 size={14} />
                    <span>View Full Image</span>
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center bg-white space-y-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center space-x-1.5 mx-auto"
                  >
                    <Upload size={14} />
                    <span>Upload Image / Receipt (or Drag & Drop)</span>
                  </button>
                  <p className="text-[10px] text-slate-400">
                    Supports JPG, PNG, Screenshots, or Clipboard Paste
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end items-center space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5"
            >
              <Check size={16} />
              <span>{editingNoteId ? 'Update Memo' : 'Save Logistics Memo'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Filter, Search & Tab Controls */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-300 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes, audio memos, marka, consignment #..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
          {/* Pinned filter toggle */}
          <button
            onClick={() => setOnlyPinned(!onlyPinned)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
              onlyPinned 
                ? 'bg-amber-500 text-white border-amber-600' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
            }`}
          >
            <Pin size={12} className={onlyPinned ? 'fill-current' : ''} />
            <span>Pinned Only</span>
          </button>

          {/* Category Chips */}
          {['All', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Modern High-Impact Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredNotes.map(note => {
          const theme = getThemeStyle(note.colorTheme);

          return (
            <div
              key={note.id}
              className={`rounded-3xl border border-slate-200 p-5 pt-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between bg-white relative group overflow-hidden ${
                note.isPinned ? 'ring-2 ring-amber-400/80 bg-amber-50/30' : ''
              }`}
            >
              <span className={`absolute inset-x-0 top-0 h-1.5 ${theme.accent}`} />
              <div>
                {/* Header Badge & Action Icons */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${getCategoryBadge(note.category)}`}>
                      {note.category}
                    </span>

                    {note.isPinned && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center space-x-0.5">
                        <Pin size={10} className="fill-current" />
                        <span>Pinned</span>
                      </span>
                    )}
                  </div>

                  {/* Actions (Pin, Copy, Edit, Delete) */}
                  <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleTogglePin(note, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        note.isPinned ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={note.isPinned ? 'Unpin' : 'Pin to Top'}
                    >
                      <Pin size={14} className={note.isPinned ? 'fill-current' : ''} />
                    </button>

                    <button
                      onClick={(e) => handleCopyNote(note, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Copy Note Text"
                    >
                      {copiedId === note.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>

                    <button
                      onClick={() => handleEditClick(note)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit Note"
                    >
                      <FileText size={14} />
                    </button>

                    <button
                      onClick={(e) => openDeleteConfirmation(note, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-extrabold text-base text-slate-950 tracking-tight mb-2">
                  {note.title}
                </h4>

                {/* Linked Shipment Tags */}
                {(note.linkedConsignmentNo || note.linkedMarka) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    {note.linkedConsignmentNo && (
                      <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        CN: {note.linkedConsignmentNo}
                      </span>
                    )}
                    {note.linkedMarka && (
                      <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        Marka: {note.linkedMarka}
                      </span>
                    )}
                  </div>
                )}

                {/* Body Content */}
                {note.content && (
                  <p className="text-xs text-slate-600 font-medium whitespace-pre-wrap leading-relaxed mb-3">
                    {note.content}
                  </p>
                )}

                {/* Voice Memo Player */}
                {note.audioDataUrl && (
                  <div className="mb-3">
                    <VoiceMemoPlayer audioUrl={note.audioDataUrl} duration={note.audioDuration} />
                  </div>
                )}

                {/* Photo Preview */}
                {note.imageUrl && (
                  <div 
                    onClick={() => setLightboxImage(note.imageUrl!)}
                    className="mb-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer relative group/img"
                  >
                    <img 
                      src={note.imageUrl} 
                      alt={note.title} 
                      className="w-full h-40 object-cover group-hover/img:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white text-xs font-bold space-x-1 transition-opacity">
                      <Maximize2 size={14} />
                      <span>View Full Image</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Timestamp Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="flex items-center space-x-1">
                  <Clock size={11} />
                  <span>
                    {new Date(note.createdAt).toLocaleDateString()} at {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>

                {note.audioDataUrl && (
                  <span className="text-amber-600 font-bold flex items-center space-x-0.5">
                    <Mic size={10} />
                    <span>Audio Available</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border-2 border-dashed border-slate-300 space-y-3">
            <StickyNote size={36} className="mx-auto text-slate-400" />
            <p className="font-bold text-slate-800 text-sm">No notes or voice memos found</p>
            <p className="text-xs text-slate-400">
              Click &quot;New Note / Voice Memo&quot; above to record spoken audio or create a note.
            </p>
          </div>
        )}
      </div>

      {/* Deletion Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        title="Do you want to delete it?"
        message="This note or voice memo will be permanently removed from the system."
        itemLabel={noteToDelete ? `Note: "${noteToDelete.title}" [${noteToDelete.category}]` : undefined}
        confirmText="Delete Note"
        cancelText="Cancel"
        onConfirm={executeDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setNoteToDelete(null);
        }}
      />

      {/* Photo Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>
            <img src={lightboxImage} alt="Enlarged cargo receipt" className="max-w-full max-h-[85vh] object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}
