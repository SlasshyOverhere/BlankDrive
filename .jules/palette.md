## 2024-05-20 - Missing ARIA labels pattern in embedded templates
**Learning:** Inputs and selects in the embedded HTML template (`src/webui/template.ts`) rely entirely on placeholders and context without visible `<label>` elements, rendering them inaccessible to screen readers.
**Action:** Always add explicit `aria-label` attributes to any form field (input, select, textarea) that lacks an associated `<label>`.
