## 2026-02-25 - [Local Web UI Error Leakage]
**Vulnerability:** The local Web UI server was exposing raw error messages in 500 responses.
**Learning:** Even for local tools, error messages can leak sensitive internal state (like file paths or DB connection strings) if not sanitized.
**Prevention:** Always wrap top-level error handlers to return generic messages to the client while logging details to stderr/logs.
