## 2024-03-24 - Missing ARIA labels in embedded templates
**Learning:** The application uses embedded HTML templates (`src/webui/template.ts`) where inputs lacking visible `<label>` elements frequently miss `aria-label` attributes, impacting accessibility.
**Action:** Always verify that embedded inputs and selects have explicit `aria-label` attributes when visible `<label>` elements are absent.
