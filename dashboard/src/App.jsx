import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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
  }
  return labels[rule] || rule
}

function App() {
  const [stats, setStats] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [connected, setConnected] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [feedbackGiven, setFeedbackGiven] = useState({})

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, anomaliesRes] = await Promise.all([
          axios.get(`${API_BASE}/stats`),
          axios.get(`${API_BASE}/anomalies?limit=25`),
        ])
        setStats(statsRes.data)
        setAnomalies(anomaliesRes.data)
        setConnected(true)
        setLastUpdated(new Date())
      } catch (err) {
        setConnected(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  async function sendFeedback(anomalyId, correct) {
    let correction_note = null
    if (!correct) {
      correction_note = window.prompt('What actually caused this? (helps the system learn)')
      if (correction_note === null) return // user cancelled
    }
    try {
      await axios.post(`${API_BASE}/anomalies/${anomalyId}/feedback`, { correct, correction_note })
      setFeedbackGiven((prev) => ({ ...prev, [anomalyId]: correct ? 'correct' : 'incorrect' }))
    } catch (err) {
      console.error('Failed to send feedback', err)
    }
  }

  const chartData = stats?.by_rule?.map((r) => ({
    name: ruleLabel(r.rule_matched),
    count: r.count,
  })) || []

  const healthyRate = stats
    ? (((stats.total_logs - stats.total_anomalies) / stats.total_logs) * 100).toFixed(1)
    : null

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◉</span>
          <span className="brand-name">incident-intelligence</span>
        </div>
        <div className={`status-pill ${connected ? 'is-live' : 'is-down'}`}>
          <span className="status-dot" />
          {connected ? 'Live' : 'API unreachable'}
          {lastUpdated && connected && (
            <span className="status-time">· updated {timeAgo(lastUpdated.toISOString())}</span>
          )}
        </div>
      </header>

      <section className="stat-row">
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
      </section>

      <section className="panel">
        <h2 className="panel-title">Anomalies by type</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" horizontal={false} />
              <XAxis type="number" stroke="#7d8590" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="#7d8590" fontSize={12} width={120} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #2a2f3a', borderRadius: 6 }}
                labelStyle={{ color: '#e6edf3' }}
              />
              <Bar dataKey="count" fill="#e0975a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="empty-state">No anomalies flagged yet — the pipeline is quiet.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Recent anomalies</h2>
        {anomalies.length > 0 ? (
          <div className="table-wrap">
            <table className="anomaly-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Explanation</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => {
                  const given = feedbackGiven[a.id] || (a.feedback_correct === true ? 'correct' : a.feedback_correct === false ? 'incorrect' : null)
                  return (
                    <tr key={a.id}>
                      <td className="cell-time">{timeAgo(a.timestamp)}</td>
                      <td>
                        <span className={`tag tag--${a.rule_matched}`}>{ruleLabel(a.rule_matched)}</span>
                      </td>
                      <td className="cell-mono">{a.route || '—'}</td>
                      <td className="cell-mono">{a.status_code ?? '—'}</td>
                      <td className="cell-mono">{a.response_time_ms != null ? `${a.response_time_ms}ms` : '—'}</td>
                      <td className="cell-message">{a.explanation || <span className="pending">generating…</span>}</td>
                      <td className="cell-feedback">
                        {given ? (
                          <span className={`feedback-done feedback-done--${given}`}>
                            {given === 'correct' ? '✓ marked correct' : '✎ correction saved'}
                          </span>
                        ) : (
                          <div className="feedback-buttons">
                            <button className="fb-btn fb-up" onClick={() => sendFeedback(a.id, true)} title="AI got this right">
                              👍
                            </button>
                            <button className="fb-btn fb-down" onClick={() => sendFeedback(a.id, false)} title="AI got this wrong">
                              👎
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Nothing flagged yet.</p>
        )}
      </section>
    </div>
  )
}

export default App