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
  Undo, Redo, Share2, Check, CloudLightning, CloudCheck 
} from 'lucide-react';

interface EditorProps {
  token: string;
  username: string;
  docId: string;
  onBackToDashboard: () => void;
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

export default function Editor({ token, username, docId, onBackToDashboard }: EditorProps) {
  const [docTitle, setDocTitle] = useState('Loading document...');
  const [activeUsers, setActiveUsers] = useState<{ name: string; color: string }[]>([]);
  const [shared, setShared] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'syncing' | 'saved'>('connecting');
  const [error, setError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);

  // 1. Fetch document title on load
  useEffect(() => {
    const fetchDocDetails = async () => {
      try {
        const response = await fetch(`http://localhost:3000/documents/${docId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Document details not found');
        }
        const data = await response.json();
        setDocTitle(data.title);
      } catch (err: any) {
        setError('Error loading document info');
      }
    };
    fetchDocDetails();
  }, [docId, token]);

  // 2. Initialize Yjs, Socket.io, and Awareness
  useEffect(() => {
    // Create Y.Doc and Awareness
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    ydocRef.current = ydoc;
    awarenessRef.current = awareness;

    // Connect to WebSocket
    setSyncStatus('connecting');
    const socket = io('http://localhost:3000', {
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
      ydoc.destroy();
      awareness.destroy();
      ydocRef.current = null;
      awarenessRef.current = null;
      socketRef.current = null;
    };
  }, [docId, token, username]);

  // 3. Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Collaborative extensions handle their own undo/redo
      }),
      Collaboration.configure({
        document: ydocRef.current || new Y.Doc(),
      }),
      CollaborationCursor.configure({
        provider: { awareness: awarenessRef.current! },
        user: {
          name: username,
          color: getColorForUsername(username),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'ProseMirror focus:outline-none min-h-[500px] max-w-none text-slate-200 leading-relaxed text-lg p-8 select-text',
      },
    },
  }, [ydocRef.current]);

  const handleShare = () => {
    // Construct the direct shareable URL
    const shareUrl = `${window.location.origin}/?docId=${docId}`;
    navigator.clipboard.writeText(shareUrl);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md p-6 rounded-2xl border border-red-500/20 bg-red-500/10 text-center">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <button
            onClick={onBackToDashboard}
            className="px-4.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Editor Header */}
      <header className="sticky top-0 z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToDashboard}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-100 line-clamp-1 max-w-[200px] md:max-w-[400px]">
                {docTitle}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {syncStatus === 'connecting' && (
                  <>
                    <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span className="text-xs text-amber-500/80 font-medium">Reconnecting...</span>
                  </>
                )}
                {syncStatus === 'syncing' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs text-indigo-400 font-medium">Syncing changes...</span>
                  </>
                )}
                {syncStatus === 'saved' && (
                  <>
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-emerald-500/80 font-medium">All changes saved</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Active User Avatars */}
            <div className="flex items-center -space-x-2.5 overflow-hidden">
              {activeUsers.map((user, idx) => (
                <div
                  key={idx}
                  className="w-8.5 h-8.5 rounded-full border-2 border-slate-950 flex items-center justify-center text-xs font-bold text-white relative group cursor-default"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-900 text-slate-200 border border-slate-800 text-[10px] rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                    {user.name}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-slate-800 hover:border-violet-500 bg-slate-900/40 text-slate-300 hover:text-white text-sm font-semibold transition cursor-pointer"
            >
              {shared ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Share2 className="w-4.5 h-4.5" />}
              <span>{shared ? 'Link Copied' : 'Share Link'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Editor Formatting Toolbar */}
      {editor && (
        <div className="sticky top-16 z-9 border-b border-slate-900 bg-slate-900/20 backdrop-blur-md py-2.5">
          <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('bold') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Bold"
            >
              <Bold className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('italic') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Italic"
            >
              <Italic className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().focus().toggleStrike().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('strike') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Strikethrough"
            >
              <Strikethrough className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('code') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="CodeInline"
            >
              <Code className="w-4.5 h-4.5" />
            </button>

            <div className="w-[1px] h-6 bg-slate-900 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('heading', { level: 1 }) 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Heading 1"
            >
              <Heading1 className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('heading', { level: 2 }) 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Heading 2"
            >
              <Heading2 className="w-4.5 h-4.5" />
            </button>

            <div className="w-[1px] h-6 bg-slate-900 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('bulletList') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Bullet List"
            >
              <List className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('orderedList') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Ordered List"
            >
              <ListOrdered className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                editor.isActive('codeBlock') 
                  ? 'bg-violet-600 text-white' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
              title="Code Block"
            >
              <Terminal className="w-4.5 h-4.5" />
            </button>

            <div className="w-[1px] h-6 bg-slate-900 mx-1.5" />

            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Undo"
            >
              <Undo className="w-4.5 h-4.5" />
            </button>

            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
              title="Redo"
            >
              <Redo className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-grow max-w-3xl w-full mx-auto px-4 py-8">
        <div className="rounded-3xl border border-slate-900 bg-slate-900/10 backdrop-blur-xl shadow-xl min-h-[500px]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
