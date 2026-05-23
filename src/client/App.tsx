import { useState, useEffect } from 'react';
import type { ClaimState, ShiftLog, ActiveMod } from '../shared/schema.js';
import './styles.css';

export function App({ subreddit, username }: { subreddit: string; username: string }) {
  const [activeTab, setActiveTab] = useState<'claims' | 'shifts' | 'roster'>('claims');
  const [claims, setClaims] = useState<ClaimState[]>([]);
  const [logs, setLogs] = useState<ShiftLog[]>([]);
  const [roster, setRoster] = useState<ActiveMod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [newNote, setNewNote] = useState('');
  const [category, setCategory] = useState<'handover' | 'alert' | 'general'>('general');

  useEffect(() => {
    fetchData();
    // Poll every 15 seconds to keep dashboard updated in real-time
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [activeTab, subreddit]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ subreddit });
      if (activeTab === 'claims') {
        const res = await fetch(`/api/claims?${params}`);
        if (!res.ok) throw new Error('Failed to fetch active claims');
        setClaims(await res.json());
      } else if (activeTab === 'shifts') {
        const res = await fetch(`/api/shifts?${params}`);
        if (!res.ok) throw new Error('Failed to fetch shift logs');
        setLogs(await res.json());
      } else if (activeTab === 'roster') {
        const res = await fetch(`/api/roster?${params}`);
        if (!res.ok) throw new Error('Failed to fetch active roster');
        setRoster(await res.json());
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': username
        },
        body: JSON.stringify({ subreddit, message: newNote, category }),
      });
      if (!res.ok) throw new Error('Failed to post shift note');

      setNewNote('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit shift note.');
    }
  };

  const handleReleaseClaim = async (postId: string) => {
    try {
      const params = new URLSearchParams({ subreddit });
      const res = await fetch(`/api/claims/${postId}?${params}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to release claim');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to release claim.');
    }
  };

  const getRelativeTimeStr = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    if (diffMins < 1) return 'Active just now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    return `Active ${Math.floor(diffHours / 24)}d ago`;
  };

  const getRemainingTimeStr = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    const diffMins = Math.max(0, Math.round(diffMs / 1000 / 60));
    return `${diffMins}m`;
  };

  const isUrgent = (expiresAt: number) => {
    const diffMs = expiresAt - Date.now();
    const diffMins = diffMs / 1000 / 60;
    return diffMins > 0 && diffMins < 5;
  };

  return (
    <div className="glass-card">
      <h2>👥 Subreddit TeamSpace: r/{subreddit}</h2>
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`} onClick={() => setActiveTab('claims')}>Queue Claims</button>
        <button className={`tab-btn ${activeTab === 'shifts' ? 'active' : ''}`} onClick={() => setActiveTab('shifts')}>Shift logs</button>
        <button className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>Duty Roster</button>
      </div>

      {error && <div style={{ color: 'var(--accent-red)', marginBottom: '16px', fontSize: '14px' }}>⚠️ {error}</div>}

      {activeTab === 'claims' && (
        <div>
          <h3>📌 Active Claims</h3>
          {isLoading && claims.length === 0 ? <p>Loading claims...</p> : claims.length === 0 ? <p>No active queue claims.</p> : (
            <table>
              <thead>
                <tr>
                  <th>Post ID</th>
                  <th>Claimed By</th>
                  <th>Claim Time</th>
                  <th>Expires In</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  const urgent = isUrgent(c.expiresAt);
                  return (
                    <tr key={c.postId}>
                      <td><code>{c.postId}</code></td>
                      <td>u/{c.claimedBy}</td>
                      <td>{new Date(c.claimedAt).toLocaleTimeString()}</td>
                      <td className={`expiry-countdown ${urgent ? 'urgent' : 'active'}`}>
                        {getRemainingTimeStr(c.expiresAt)}
                      </td>
                      <td>
                        <button className="secondary" onClick={() => handleReleaseClaim(c.postId)}>
                          Release Lock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'shifts' && (
        <div>
          <h3>📋 Shift Handoff Notes</h3>
          <form onSubmit={handlePostNote} style={{ marginBottom: '24px' }}>
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)}>
                <option value="general">General Note</option>
                <option value="handover">Shift Handover</option>
                <option value="alert">🚨 Action Alert</option>
              </select>
            </div>
            <div className="form-group">
              <label>Log Message</label>
              <textarea 
                placeholder="Write handover description or alerts..." 
                value={newNote} 
                onChange={e => setNewNote(e.target.value)} 
                required
              />
            </div>
            <button className="primary" type="submit">Add Shift Log</button>
          </form>

          <div style={{ marginTop: '20px' }}>
            {isLoading && logs.length === 0 ? <p>Loading logs...</p> : logs.length === 0 ? <p>No shift notes logged.</p> : (
              logs.map(log => (
                <div key={log.id} className="log-item">
                  <div className="log-header">
                    <div>
                      <span className={`badge ${log.category}`}>
                        {log.category === 'alert' ? '🚨 ALERT' : log.category === 'handover' ? 'HANDOVER' : 'GENERAL'}
                      </span>
                      <strong style={{ marginLeft: '8px' }}>u/{log.mod}</strong>
                    </div>
                    <span className="log-meta">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="log-message">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'roster' && (
        <div>
          <h3>👤 Moderator Activity (24h)</h3>
          {isLoading && roster.length === 0 ? <p>Loading roster...</p> : roster.length === 0 ? <p>No active moderators found.</p> : (
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {roster.map(r => (
                <li key={r.username} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>u/{r.username}</strong>
                  <span className="log-meta">{getRelativeTimeStr(r.lastActiveAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
