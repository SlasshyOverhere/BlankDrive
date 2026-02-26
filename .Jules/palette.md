## 2024-05-22 - Placeholder-only Inputs
**Learning:** The application heavily relies on `placeholder` attributes for input labels to maintain a clean UI, which severely impacts accessibility.
**Action:** Systematically add `aria-label` to all inputs where visible labels are omitted to ensure screen reader compatibility without altering the visual design.
