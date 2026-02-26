## 2025-05-23 - [API Client Overhead]
**Learning:** Wrapper functions around external APIs (like Google Drive) should avoid automatic "convenience" calls (like fetching file size) unless explicitly requested, as these add significant latency (1 RTT) per operation in bulk processing flows.
**Action:** When refactoring API clients, make metadata fetching optional or lazy-loaded.
