import { useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'
const REFRESH_MS = 4000

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function ruleLabel(rule) {
  const labels = {
    error_status_code: 'Error status',
    latency_spike: 'Latency spike',
    missing_response_time: 'No response time',
    crash_pattern: 'Crash pattern',
    ml_isolation_forest: 'ML detector',
  }
  return labels[rule] || rule
}

function freshnessStatus(lastActivity) {
  if (!lastActivity) return 'idle'
  const seconds = (Date.now() - new Date(lastActivity)) / 1000
  if (seconds < 15) return 'active'
  if (seconds < 120) return 'idle'
  return 'stale'
}

function severityLabel(severity) {
  const labels = { critical: 'Critical', warning: 'Warning', info: 'Info' }
  return labels[severity] || severity || 'Pending'
}

/* ---------- small inline icons (no extra deps) ---------- */
const Icon = {
  overview: () => (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  charts: () => (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M3 17V9M9 17V3M15 17v-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  pipeline: () => (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><circle cx="4" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="16" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 10h8" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  anomalies: () => (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M10 2 2 17h16L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M10 8v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="10" cy="14.2" r="0.9" fill="currentColor"/></svg>
  ),
  memory: () => (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><ellipse cx="10" cy="5" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 5v10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  search: () => (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="m17 17-3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ),
  refresh: () => (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  collapse: () => (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><rect x="2.5" y="3" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 3v14" stroke="currentColor" strokeWidth="1.4"/></svg>
  ),
  close: () => (
    <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  menu: () => (
    <svg viewBox="0 0 20 20" width="17" height="17" fill="none"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'charts', label: 'Charts', icon: 'charts' },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline' },
  { id: 'anomalies', label: 'Anomalies', icon: 'anomalies' },
  { id: 'memory', label: 'Memory & feedback', icon: 'memory' },
]

const SEVERITY_FILTERS = ['all', 'critical', 'warning', 'info']

function Sidebar({ collapsed, onToggle, activeSection, onNavClick, connected, lastUpdated, health, mobileOpen }) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark">◉</span>
          {!collapsed && <span className="brand-name">incident-intelligence</span>}
        </div>
        <button className="icon-btn" onClick={onToggle} title="Toggle sidebar">
          <Icon.collapse />
        </button>
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <span className="sidebar-group-label">Monitor</span>}
        {NAV_ITEMS.map((item) => {
          const IconCmp = Icon[item.icon]
          return (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'nav-item--active' : ''}`}
              onClick={() => onNavClick(item.id)}
              title={item.label}
            >
              <IconCmp />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className={`status-pill ${connected ? 'is-live' : 'is-down'}`}>
          <span className="status-dot" />
          {!collapsed && (connected ? 'Live' : 'API unreachable')}
        </div>
        {!collapsed && lastUpdated && connected && (
          <span className="sidebar-updated">updated {timeAgo(lastUpdated.toISOString())}</span>
        )}
        {!collapsed && (
          <span className="sidebar-updated sidebar-updated--muted">
            {health?.vector_db?.incident_count ?? 0} incidents in memory
          </span>
        )}
      </div>
    </aside>
  )
}

function DetailPanel({ anomaly, onClose, feedbackState, onFeedback }) {
  if (!anomaly) return null
  const given = feedbackState

  return (
    <aside className="detail-drawer">
      <div className="detail-drawer-header">
        <div>
          <span className={`sev sev--${anomaly.severity || 'pending'}`}>{severityLabel(anomaly.severity)}</span>
          <h3>{ruleLabel(anomaly.rule_matched)}</h3>
          <span className="detail-drawer-time">{timeAgo(anomaly.timestamp)} · {anomaly.route || 'unknown route'}</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">
          <Icon.close />
        </button>
      </div>

      <div className="detail-drawer-body">
        <div className="drawer-block">
          <span className="drawer-block-label">Status / latency</span>
          <span className="drawer-block-mono">
            {anomaly.status_code ?? '—'} · {anomaly.response_time_ms != null ? `${anomaly.response_time_ms}ms` : 'no timing data'}
          </span>
        </div>

        <div className="drawer-block">
          <span className="drawer-block-label">Raw log message</span>
          <span className="drawer-block-mono">{anomaly.message || '—'}</span>
        </div>

        <div className="drawer-block drawer-block--card">
          <span className="drawer-block-label">Matched past incident (RAG retrieval)</span>
          <span>{anomaly.matched_incident || 'No similar past incident found.'}</span>
        </div>

        <div className="drawer-block drawer-block--card drawer-block--llm">
          <span className="drawer-block-label">LLM explanation</span>
          <span>{anomaly.explanation || <span className="pending">still generating…</span>}</span>
        </div>
      </div>

      <div className="detail-drawer-footer">
        {given ? (
          <span className={`feedback-done feedback-done--${given}`}>
            {given === 'correct' ? '✓ marked correct' : '✎ correction saved'}
          </span>
        ) : (
          <div className="feedback-buttons">
            <button className="fb-btn fb-up" onClick={() => onFeedback(anomaly.id, true)}>👍 Correct</button>
            <button className="fb-btn fb-down" onClick={() => onFeedback(anomaly.id, false)}>👎 Wrong</button>
          </div>
        )}
      </div>
    </aside>
  )
}

function App() {
  const [stats, setStats] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [health, setHealth] = useState(null)
  const [connected, setConnected] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [feedbackGiven, setFeedbackGiven] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, anomaliesRes, healthRes] = await Promise.all([
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/anomalies?limit=25`),
        axios.get(`${API_BASE}/system-health`),
      ])
      setStats(statsRes.data)
      setAnomalies(anomaliesRes.data)
      setHealth(healthRes.data)
      setConnected(true)
      setLastUpdated(new Date())
    } catch (err) {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  async function sendFeedback(anomalyId, correct) {
    let correction_note = null
    if (!correct) {
      correction_note = window.prompt('What actually caused this? (helps the system learn)')
      if (correction_note === null) return
    }
    try {
      await axios.post(`${API_BASE}/anomalies/${anomalyId}/feedback`, { correct, correction_note })
      setFeedbackGiven((prev) => ({ ...prev, [anomalyId]: correct ? 'correct' : 'incorrect' }))
    } catch (err) {
      console.error('Failed to send feedback', err)
    }
  }

  function handleNavClick(id) {
    setActiveSection(id)
    setMobileNavOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (a.route || '').toLowerCase().includes(q) ||
        (a.message || '').toLowerCase().includes(q) ||
        ruleLabel(a.rule_matched).toLowerCase().includes(q)
      )
    })
  }, [anomalies, severityFilter, searchQuery])

  const chartData = stats?.by_rule?.map((r) => ({
    name: ruleLabel(r.rule_matched),
    count: r.count,
  })) || []

  const trendData = useMemo(() => {
    const chronological = [...anomalies].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    let running = 0
    return chronological.map((a) => {
      running += 1
      return {
        time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        total: running,
      }
    })
  }, [anomalies])

  const healthyRate = stats
    ? (((stats.total_logs - stats.total_anomalies) / stats.total_logs) * 100).toFixed(1)
    : null

  const selectedAnomaly = anomalies.find((a) => a.id === selectedId) || null

  return (
    <div className={`dashboard-shell ${selectedAnomaly ? 'dashboard-shell--panel-open' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        activeSection={activeSection}
        onNavClick={handleNavClick}
        connected={connected}
        lastUpdated={lastUpdated}
        health={health}
        mobileOpen={mobileNavOpen}
      />
      {mobileNavOpen && <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-area">
        <div className="topbar">
          <button className="icon-btn icon-btn--ghost hamburger-btn" onClick={() => setMobileNavOpen((v) => !v)} title="Menu">
            <Icon.menu />
          </button>
          <div className="topbar-search">
            <Icon.search />
            <input
              type="text"
              placeholder="Search route, message, or type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="severity-chips">
            {SEVERITY_FILTERS.map((s) => (
              <button
                key={s}
                className={`chip chip--${s} ${severityFilter === s ? 'chip--active' : ''}`}
                onClick={() => setSeverityFilter(s)}
              >
                {s === 'all' ? 'All' : severityLabel(s)}
              </button>
            ))}
          </div>

          <button className="icon-btn icon-btn--ghost" onClick={fetchData} title="Refresh now">
            <Icon.refresh />
          </button>
        </div>

        <div className="content-scroll">
        <div className="content-inner">
          <section id="overview" className="stat-row">
            <div className="stat-card">
              <span className="stat-label">Total logs processed</span>
              <span className="stat-value">{stats?.total_logs?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Anomalies flagged</span>
              <span className="stat-value stat-value--alert">{stats?.total_anomalies?.toLocaleString() ?? '—'}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Healthy rate</span>
              <span className="stat-value stat-value--good">{healthyRate ? `${healthyRate}%` : '—'}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Feedback learned</span>
              <span className="stat-value">{health?.feedback?.corrections_learned ?? 0}<span className="stat-value-sub"> / {health?.feedback?.total_given ?? 0}</span></span>
            </div>
          </section>

          <section id="charts" className="chart-grid">
            <div className="panel">
              <h2 className="panel-title">Anomalies by type</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" horizontal={false} />
                    <XAxis type="number" stroke="#7d8590" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#7d8590" fontSize={12} width={120} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a2f3a', borderRadius: 6 }} labelStyle={{ color: '#e6edf3' }} />
                    <Bar dataKey="count" fill="#d4d6db" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-state">No anomalies flagged yet — the pipeline is quiet.</p>
              )}
            </div>

            <div className="panel">
              <h2 className="panel-title">Anomalies over time (recent 25)</h2>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ left: 0, right: 20, top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
                    <XAxis dataKey="time" stroke="#7d8590" fontSize={11} />
                    <YAxis stroke="#7d8590" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a2f3a', borderRadius: 6 }} labelStyle={{ color: '#e6edf3' }} />
                    <Line type="monotone" dataKey="total" stroke="#d2a8ff" strokeWidth={2} dot={{ r: 3, fill: '#d2a8ff' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-state">Not enough data yet to plot a trend.</p>
              )}
            </div>
          </section>

          <section id="pipeline" className="panel">
            <h2 className="panel-title">Pipeline health</h2>
            <div className="pipeline-strip">
              {[
                { key: 'ingestion', label: 'Ingestion', detail: health?.ingestion?.last_activity },
                { key: 'detection', label: 'Detection', detail: health?.detection?.last_activity },
                { key: 'explanation', label: 'RAG + LLM', detail: health?.explanation?.last_activity },
                { key: 'triage', label: 'Triage/Alert', detail: health?.triage?.last_activity },
              ].map((stage) => {
                const status = freshnessStatus(stage.detail)
                return (
                  <div key={stage.key} className={`pipeline-node pipeline-node--${status}`}>
                    <span className="pipeline-dot" />
                    <div className="pipeline-node-text">
                      <span className="pipeline-label">{stage.label}</span>
                      <span className="pipeline-time">{stage.detail ? timeAgo(stage.detail) : 'no activity yet'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section id="anomalies" className="panel">
            <h2 className="panel-title">
              Recent anomalies
              {(searchQuery || severityFilter !== 'all') && (
                <span className="panel-title-count"> — {filteredAnomalies.length} shown</span>
              )}
            </h2>
            {filteredAnomalies.length > 0 ? (
              <div className="table-wrap">
                <table className="anomaly-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Latency</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.map((a) => {
                      const given = feedbackGiven[a.id] || (a.feedback_correct === true ? 'correct' : a.feedback_correct === false ? 'incorrect' : null)
                      return (
                        <tr
                          key={a.id}
                          className={`row-clickable ${selectedId === a.id ? 'row-open' : ''}`}
                          onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                        >
                          <td className="cell-time">{timeAgo(a.timestamp)}</td>
                          <td><span className={`tag tag--${a.rule_matched}`}>{ruleLabel(a.rule_matched)}</span></td>
                          <td><span className={`sev sev--${a.severity || 'pending'}`}>{severityLabel(a.severity)}</span></td>
                          <td className="cell-mono">{a.route || '—'}</td>
                          <td className="cell-mono">{a.status_code ?? '—'}</td>
                          <td className="cell-mono">{a.response_time_ms != null ? `${a.response_time_ms}ms` : '—'}</td>
                          <td className="cell-feedback">
                            {given ? (
                              <span className={`feedback-done feedback-done--${given}`}>
                                {given === 'correct' ? '✓ correct' : '✎ corrected'}
                              </span>
                            ) : (
                              <span className="feedback-hint">click row →</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">
                {anomalies.length > 0 ? 'No anomalies match your filters.' : 'Nothing flagged yet.'}
              </p>
            )}
          </section>

          <section id="memory" className="chart-grid">
            <div className="panel">
              <h2 className="panel-title">Vector memory</h2>
              <div className="mini-stat">
                <span className="stat-value">{health?.vector_db?.incident_count ?? '—'}</span>
                <span className="stat-label">past incidents stored for RAG retrieval</span>
              </div>
            </div>
            <div className="panel">
              <h2 className="panel-title">Feedback learned</h2>
              <div className="mini-stat">
                <span className="stat-value">
                  {health?.feedback?.corrections_learned ?? 0}
                  <span className="stat-value-sub"> / {health?.feedback?.total_given ?? 0}</span>
                </span>
                <span className="stat-label">corrections folded back into the model</span>
              </div>
            </div>
          </section>
        </div>
        </div>
      </div>

      <DetailPanel
        anomaly={selectedAnomaly}
        onClose={() => setSelectedId(null)}
        feedbackState={selectedAnomaly ? (feedbackGiven[selectedAnomaly.id] || (selectedAnomaly.feedback_correct === true ? 'correct' : selectedAnomaly.feedback_correct === false ? 'incorrect' : null)) : null}
        onFeedback={sendFeedback}
      />
    </div>
  )
}

export default App