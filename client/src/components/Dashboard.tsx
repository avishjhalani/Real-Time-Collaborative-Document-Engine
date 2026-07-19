import { useState, useEffect } from 'react';
import { 
  Plus, FileText, LogOut, Clock, Calendar, 
  User, Trash2, Cpu, Activity, Database 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface DocumentInfo {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardProps {
  token: string;
  username: string;
  onSelectDocument: (docId: string) => void;
  onLogout: () => void;
}

export default function Dashboard({ token, username, onSelectDocument, onLogout }: DashboardProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setCreating(true);
    setError('');
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
      onSelectDocument(newDoc.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDocument = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation(); // Avoid triggering open document click handler
    if (!confirm('Are you sure you want to delete this document? This action is irreversible.')) return;

    setDeletingId(docId);
    try {
      const response = await fetch(`${API_URL}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments(documents.filter(doc => doc.id !== docId));
    } catch (err: any) {
      alert(err.message || 'Could not delete the document');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Decorative Blur Globs */}
      <div className="absolute top-10 left-10 ambient-glow-1" />
      <div className="absolute bottom-10 right-10 ambient-glow-2" />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-900/60 bg-black/60 backdrop-blur-xl relative">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Collab Docs
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm">
              <div className="w-6 h-6 rounded-full bg-violet-600/10 text-violet-400 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-200">{username}</span>
            </div>
            
            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl border border-zinc-900 hover:border-red-500/20 hover:bg-red-500/5 text-zinc-500 hover:text-red-400 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 py-8 relative z-1">
        
        {/* Workspace banner and New Doc action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Workspace</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Manage, organize, and collaborate on your documents in real-time.</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-violet-950/50 active:scale-[0.98] transition cursor-pointer self-start"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>New Document</span>
          </button>
        </div>

        {/* Workspace Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Documents</span>
              <h4 className="text-xl font-black text-white mt-0.5">{documents.length}</h4>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Engine Status</span>
              <h4 className="text-xl font-black text-emerald-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Active</span>
              </h4>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Cluster Peers</span>
              <h4 className="text-xl font-black text-white mt-0.5">Redis Sync</h4>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl border border-zinc-900 bg-zinc-950/20 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl border border-dashed border-zinc-900 bg-zinc-950/20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 mb-4">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-zinc-300">No documents yet</h3>
            <p className="text-zinc-500 text-xs mt-1 mb-6 text-center max-w-xs leading-relaxed">
              Create a document to start writing, formatting, and collaborating.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 hover:border-violet-500 bg-zinc-950 hover:bg-violet-600 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="group p-5.5 rounded-2xl border border-zinc-900 hover:border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/80 hover:shadow-[0_12px_40px_rgba(0,0,0,0.7)] transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-40"
              >
                {/* Accent glow on top of card */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400 group-hover:bg-violet-600/10 group-hover:text-violet-400 transition-colors duration-300">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    
                    <button
                      onClick={(e) => handleDeleteDocument(e, doc.id)}
                      disabled={deletingId === doc.id}
                      className="p-2 rounded-lg border border-transparent hover:border-red-500/20 hover:bg-red-500/5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="font-bold text-sm text-zinc-100 group-hover:text-violet-400 transition-colors mt-3 line-clamp-1">
                    {doc.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-4 border-t border-zinc-900/60 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-8 rounded-3xl border border-zinc-900 bg-zinc-950 shadow-2xl relative">
            <h3 className="text-lg font-extrabold text-white">Create Document</h3>
            <p className="text-zinc-500 text-xs mt-1 mb-6">Enter a title for your document to start collaborating.</p>

            <form onSubmit={handleCreateDocument} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. Q3 Strategy Launch"
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
