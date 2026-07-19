import { useState } from 'react';
import { Shield, Sparkles, Zap, Users } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (token: string, username: string) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const url = isLogin ? `${API_URL}/auth/login` : `${API_URL}/auth/signup`;
    const body = isLogin ? { email, password } : { email, password, username };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      if (data.token) {
        onAuthSuccess(data.token, data.username);
      } else {
        throw new Error('Token missing from response');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Soft Ambient Globs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 ambient-glow-1" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 ambient-glow-2" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-zinc-800/80 bg-zinc-950/30 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.80)] overflow-hidden relative z-1">
        
        {/* Left Panel: App Teaser (hidden on mobile/tablet) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-zinc-900/60 via-zinc-950/80 to-black p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-zinc-800/80 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-lg bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Collab Docs</span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              Real-time collaboration, reinvented.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              A high-performance workspace combining collaborative editing, dynamic presence tracking, and instant synchronization.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-violet-600/10 text-violet-400 mt-0.5">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-200">Instant CRDT Engine</h4>
                <p className="text-zinc-400 text-xs mt-1">Typing is synchronized instantly using conflicts-free Yjs updates.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-violet-600/10 text-violet-400 mt-0.5">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-200">Dynamic User Presence</h4>
                <p className="text-zinc-400 text-xs mt-1">See active collaborators and their cursor selections in real-time.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-violet-600/10 text-violet-400 mt-0.5">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-200">Secure Sessions</h4>
                <p className="text-zinc-400 text-xs mt-1">Authentication powered by industry-standard secure JWT validation.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-zinc-800/40 text-xs text-zinc-500 font-medium">
            Engine Version 1.1.0 • Running on Node-Cluster
          </div>
        </div>

        {/* Right Panel: Authentication Form */}
        <div className="lg:col-span-7 p-8 lg:p-12 bg-black/40 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {isLogin ? 'Welcome Back' : 'Create Workspace'}
              </h3>
              <p className="text-zinc-400 text-sm mt-1.5">
                {isLogin ? 'Enter your credentials to access your documents.' : 'Get started by creating your collaborative account.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm animate-shake flex items-start gap-2.5">
                <svg className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="john_doe"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:shadow-[0_0_15px_rgba(124,58,237,0.15)] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-semibold shadow-lg shadow-violet-950/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLogin ? (
                  'Sign In to Space'
                ) : (
                  'Create Free Account'
                )}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-sm font-medium text-zinc-400 hover:text-white transition cursor-pointer"
              >
                {isLogin ? (
                  <>
                    New to Collab Docs? <span className="text-violet-400 hover:underline font-semibold">Create account</span>
                  </>
                ) : (
                  <>
                    Already have an account? <span className="text-violet-400 hover:underline font-semibold">Sign In</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
