import { useState, useEffect } from 'react';
import { Plus, FileText, LogOut, Clock, Calendar, ChevronRight, User } from 'lucide-react';

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

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:3000/documents', {
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
      const response = await fetch('http://localhost:3000/documents', {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <FileText className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-xl font-extrabold bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Collab Docs
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="w-6 h-6 rounded-full bg-violet-600/20 text-violet-400 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-semibold text-slate-200">{username}</span>
            </div>
            
            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-red-500/30 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Your Workspace</h2>
            <p className="text-slate-400 text-sm mt-1">Manage, collaborate, and edit your documents in real-time.</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-violet-900/20 hover:shadow-violet-900/30 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>New Document</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl border border-slate-900 bg-slate-900/20 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl border border-dashed border-slate-800 bg-slate-900/10">
            <div className="w-16 h-16 rounded-2xl bg-slate-900/50 flex items-center justify-center text-slate-500 mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-300">No documents yet</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6 text-center max-w-xs">
              Create your first document to start collaborating with your team in real-time.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-slate-700 hover:border-violet-500 bg-slate-900 hover:bg-violet-600 text-slate-300 hover:text-white font-medium transition cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Create Document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="group p-6 rounded-2xl border border-slate-900 hover:border-slate-800 bg-slate-900/20 hover:bg-slate-900/40 shadow-sm hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-44"
              >
                {/* Visual hover effect line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div>
                  <div className="flex items-start justify-between">
                    <div className="p-2.5 rounded-xl bg-violet-600/10 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-300">
                      <FileText className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-100 group-hover:text-violet-400 transition-colors mt-4 line-clamp-1">
                    {doc.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 border-t border-slate-900/60 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Edited {new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Created {new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl relative animate-scaleUp">
            <h3 className="text-xl font-bold text-white mb-2">Create a New Document</h3>
            <p className="text-slate-400 text-sm mb-6">Enter a title for your document to start collaborating.</p>

            <form onSubmit={handleCreateDocument} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="e.g. Project Roadmap"
                  className="w-full px-4 py-3 rounded-xl border border-slate-850 bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
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
                  className="px-4.5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDocTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold transition disabled:opacity-50 cursor-pointer"
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
