import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { io, Socket } from 'socket.io-client';
import { 
  ArrowLeft, Bold, Italic, Strikethrough, Code, 
  Heading1, Heading2, List, ListOrdered, Terminal, 
  Undo, Redo, Share2, Check, CloudLightning, CloudCheck,
  ChevronLeft, ChevronRight, Plus, FileText, Edit3, User
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface DocumentInfo {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface EditorProps {
  token: string;
  username: string;
  docId: string;
  onBackToDashboard: () => void;
  onSelectDocument?: (docId: string) => void;
}

const colors = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', 
  '#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#c084fc', '#f472b6', '#fb7185'
];

function getColorForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function Editor({ token, username, docId, onBackToDashboard, onSelectDocument }: EditorProps) {
  const [docTitle, setDocTitle] = useState('Loading...');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [activeUsers, setActiveUsers] = useState<{ name: string; color: string }[]>([]);
  const [shared, setShared] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'syncing' | 'saved'>('connecting');
  const [error, setError] = useState('');
  
  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarDocs, setSidebarDocs] = useState<DocumentInfo[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const [ydoc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new Awareness(ydoc));

  // 1. Fetch document details and sidebar documents on load
  useEffect(() => {
    fetchDocDetails();
    fetchSidebarDocuments();
  }, [docId, token]);

  const fetchDocDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/documents/${docId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Document details not found');
      }
      const data = await response.json();
      setDocTitle(data.title);
      setEditedTitle(data.title);
    } catch (err: any) {
      setError('Error loading document info');
    }
  };

  const fetchSidebarDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSidebarDocs(data);
      }
    } catch (err) {
      console.error('Failed to load documents list for sidebar:', err);
    }
  };

  const handleRenameDocument = async () => {
    if (!editedTitle.trim() || editedTitle === docTitle) {
      setIsEditingTitle(false);
      setEditedTitle(docTitle);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editedTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename document');
      }

      setDocTitle(editedTitle);
      setIsEditingTitle(false);
      fetchSidebarDocuments(); // Refresh sidebar list to reflect new name
    } catch (err: any) {
      alert(err.message || 'Could not rename document');
      setEditedTitle(docTitle);
      setIsEditingTitle(false);
    }
  };

  const handleCreateDocumentFromSidebar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newDocTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const newDoc = await response.json();
      setNewDocTitle('');
      setShowCreateModal(false);
      if (onSelectDocument) {
        onSelectDocument(newDoc.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  // 2. Initialize Socket.io connection and listeners
  useEffect(() => {
    // Connect to WebSocket
    setSyncStatus('connecting');
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connection established!');
      setSyncStatus('syncing');
      socket.emit('join-document', { docId });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected.');
      setSyncStatus('connecting');
    });

    // Handle document state initialization
    socket.on('init-document-state', (stateUpdate: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(stateUpdate), 'server');
      setSyncStatus('saved');
    });

    // Handle document updates from other users
    socket.on('update-document', (updateBinary: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(updateBinary), 'server');
      setSyncStatus('saved');
    });

    // Handle awareness updates (cursors, presence)
    socket.on('awareness-update', (awarenessBinary: ArrayBuffer) => {
      applyAwarenessUpdate(awareness, new Uint8Array(awarenessBinary), 'server');
    });

    // Listen to local Yjs changes and propagate to backend
    ydoc.on('update', (update, origin) => {
      if (origin !== 'server') {
        setSyncStatus('syncing');
        socket.emit('update-document', update);
        // Simulate save completion shortly after typing
        setTimeout(() => {
          setSyncStatus('saved');
        }, 1000);
      }
    });

    // Listen to local awareness state changes and propagate to backend
    awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: string) => {
      if (origin !== 'server') {
        const changedClients = added.concat(updated).concat(removed);
        const state = encodeAwarenessUpdate(awareness, changedClients);
        socket.emit('awareness-update', state);
      }
    });

    // Handle presence listings in the toolbar
    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const users: { name: string; color: string }[] = [];
      states.forEach((state: any) => {
        if (state.user) {
          users.push({
            name: state.user.name,
            color: state.user.color,
          });
        }
      });
      // Filter out duplicate usernames
      const uniqueUsers = users.filter((u, idx, arr) => 
        arr.findIndex(x => x.name === u.name) === idx
      );
      setActiveUsers(uniqueUsers);
    };

    awareness.on('change', handleAwarenessChange);

    // Initial local user registration inside awareness
    awareness.setLocalStateField('user', {
      name: username,
      color: getColorForUsername(username),
    });

    // Clean up on component destruction
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [docId, token, username, ydoc, awareness]);

  // Cleanup Yjs resources on component unmount
  useEffect(() => {
    return () => {
      ydoc.destroy();
      awareness.destroy();
    };
  }, [ydoc, awareness]);

  // 3. Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Collaborative extensions handle their own undo/redo
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: { awareness },
        user: {
          name: username,
          color: getColorForUsername(username),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-[500px] max-w-none text-zinc-300 leading-relaxed text-[16px] md:text-[17px] p-8 select-text',
      },
    },
  }, [ydoc]);

  const handleShare = () => {
    // Construct the direct shareable URL
    const shareUrl = `${window.location.origin}/?docId=${docId}`;
    navigator.clipboard.writeText(shareUrl);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <button
            onClick={onBackToDashboard}
            className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e11] text-zinc-100 flex relative overflow-hidden">

      {/* Left Sidebar Panel */}
      <aside 
        className={`bg-zinc-950/40 backdrop-blur-2xl border-r border-zinc-900/60 z-20 flex flex-col justify-between shrink-0 transition-all duration-300 relative ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0'
        }`}
      >
        <div>
          {/* Sidebar Header */}
          <div className="h-16 border-b border-zinc-900/60 flex items-center justify-between px-5.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm text-white tracking-tight">Collab Workspace</span>
            </div>
            
            <button 
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              title="Close Sidebar"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Sidebar Document List */}
          <div className="p-4 space-y-5">
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>My Documents</span>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="hover:text-violet-400 transition cursor-pointer"
                title="Create document"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
              {sidebarDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectDocument && onSelectDocument(doc.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition text-xs ${
                    doc.id === docId 
                      ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20 font-bold' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{doc.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-900/60 bg-zinc-950/20 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-zinc-900 bg-zinc-950/60">
            <div className="w-6.5 h-6.5 rounded-full bg-violet-600/10 text-violet-400 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-zinc-300 truncate">{username}</span>
          </div>

          <button
            onClick={onBackToDashboard}
            className="w-full py-2.5 rounded-xl border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-zinc-950/20"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden relative z-10">
        
        {/* Editor Top Header Bar */}
        <header className="h-16 border-b border-zinc-900/60 bg-black/60 backdrop-blur-xl flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                title="Open Sidebar"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            )}

            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleRenameDocument}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameDocument()}
                  className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-white text-sm font-bold focus:outline-none focus:border-violet-500 transition w-[160px] md:w-[280px]"
                  autoFocus
                />
              ) : (
                <div 
                  onClick={() => setIsEditingTitle(true)}
                  className="flex items-center gap-1.5 group cursor-pointer hover:bg-zinc-900/30 px-3 py-1.5 rounded-xl border border-transparent hover:border-zinc-900 transition"
                >
                  <h1 className="text-sm font-bold text-zinc-200 group-hover:text-white line-clamp-1 max-w-[140px] md:max-w-[280px]">
                    {docTitle}
                  </h1>
                  <Edit3 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}

              {/* Server Sync Indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/60 border border-zinc-900/60 select-none">
                {syncStatus === 'connecting' && (
                  <>
                    <CloudLightning className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Syncing...</span>
                  </>
                )}
                {syncStatus === 'syncing' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Typing...</span>
                  </>
                )}
                {syncStatus === 'saved' && (
                  <>
                    <CloudCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400/90 font-bold uppercase tracking-wider">Saved</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Active User Avatars presence list */}
            <div className="flex items-center -space-x-2 overflow-hidden">
              {activeUsers.map((user, idx) => (
                <div
                  key={idx}
                  className="w-7.5 h-7.5 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-bold text-white relative group cursor-default"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-950 border border-zinc-900 text-[10px] rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none text-zinc-300">
                    {user.name}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-900 hover:border-violet-500 bg-zinc-950 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              {shared ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{shared ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Document Editing Workspace */}
        <div className="flex-grow overflow-y-auto px-4 py-6 flex flex-col items-center">
          
          {/* Floating Formatting Toolbar */}
          {editor && (
            <div className="w-full max-w-3xl mb-5 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl p-1.5 flex flex-wrap items-center gap-1 shadow-lg relative">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('bold') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('italic') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('strike') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('code') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Code inline"
              >
                <Code className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-5 bg-zinc-900 mx-1" />

              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('heading', { level: 1 }) 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('heading', { level: 2 }) 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-5 bg-zinc-900 mx-1" />

              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('bulletList') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('orderedList') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Ordered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  editor.isActive('codeBlock') 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
                title="Code Block"
              >
                <Terminal className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-5 bg-zinc-900 mx-1" />

              <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Paper Canvas (Distinct Document Sheet) */}
          <div className="w-full max-w-3xl min-h-[75vh] rounded-2xl border border-zinc-800/40 bg-zinc-900 shadow-2xl relative editor-card-container">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Create Modal from Sidebar */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-8 rounded-3xl border border-zinc-900 bg-zinc-950 shadow-2xl relative">
            <h3 className="text-base font-extrabold text-white">Create Document</h3>
            <p className="text-zinc-500 text-xs mt-1 mb-6">Enter a title for your document to start collaborating.</p>

            <form onSubmit={handleCreateDocumentFromSidebar} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. Workspace Notes"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-900 bg-black text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDocTitle('');
                  }}
                  className="px-4.5 py-2.5 rounded-xl border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDocTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
