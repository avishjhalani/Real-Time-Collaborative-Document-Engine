import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Check URL parameters on mount and on popstate events (browser back/forward)
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const docId = params.get('docId');
      setSelectedDocId(docId);
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleAuthSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setSelectedDocId(null);
    window.history.pushState({}, '', '/');
  };

  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
    window.history.pushState({}, '', `/?docId=${docId}`);
  };

  const handleBackToDashboard = () => {
    setSelectedDocId(null);
    window.history.pushState({}, '', '/');
  };

  if (!token || !username) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (selectedDocId) {
    return (
      <Editor
        token={token}
        username={username}
        docId={selectedDocId}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      username={username}
      onSelectDocument={handleSelectDocument}
      onLogout={handleLogout}
    />
  );
}

export default App;