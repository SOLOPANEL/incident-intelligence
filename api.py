"""
API Backend — Week 4 deliverable, part 1.

Serves your Postgres data as JSON, so the dashboard (a webpage) can display it.

Run it:
    uvicorn api:app --reload --port 8000

Then open http://localhost:8000/docs in your browser — FastAPI auto-generates
an interactive page where you can test every endpoint by clicking, no extra tools needed.
"""

import psycopg2
import psycopg2.extras
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Incident Intelligence API")

# Allows your React dashboard (running on a different port) to call this API.
# In a real production system you'd restrict this to your actual frontend's URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_connection():
    return psycopg2.connect(
        host="localhost",
        port=5432,
        dbname="incident_db",
        user="incident_user",
        password="incident_pass",
        cursor_factory=psycopg2.extras.RealDictCursor,  # returns rows as dicts, not tuples
    )


@app.get("/")
def root():
    return {"status": "Incident Intelligence API is running"}


@app.get("/anomalies")
def get_anomalies(limit: int = 50):
    """Most recent flagged anomalies, newest first."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, log_id, timestamp, template, rule_matched, route, status_code, response_time_ms, message
        FROM anomalies
        ORDER BY id DESC
        LIMIT %s
        """,
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


@app.get("/stats")
def get_stats():
    """Count of anomalies grouped by type — powers the summary cards/chart."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT rule_matched, COUNT(*) as count FROM anomalies GROUP BY rule_matched;")
    by_rule = cur.fetchall()

    cur.execute("SELECT COUNT(*) as total FROM logs;")
    total_logs = cur.fetchone()["total"]

    cur.execute("SELECT COUNT(*) as total FROM anomalies;")
    total_anomalies = cur.fetchone()["total"]

    cur.close()
    conn.close()
    return {
        "total_logs": total_logs,
        "total_anomalies": total_anomalies,
        "by_rule": by_rule,
    }


@app.get("/logs/recent")
def get_recent_logs(limit: int = 50):
    """Most recent raw logs, newest first — for a live activity feed."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, timestamp, route, user_id, status_code, response_time_ms, message
        FROM logs
        ORDER BY id DESC
        LIMIT %s
        """,
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows