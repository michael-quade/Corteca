# Project Guidelines

## Tech Stack & Styling
- **CSS Framework:** Use Tailwind CSS exclusively for all styling.
- **Prohibited Libraries:** Do not use Material UI (MUI), Emotion, or Styled Components.
- **UI Components:** Use [Headless UI](https://headlessui.com) or [Radix UI](https://www.radix-ui.com) for accessible component logic (Modals, Tabs, etc.).
- **Style Patterns:** 
  - Use utility classes directly in `className`.
  - Prefer the `cn()` utility (Tailwind Merge + CLSX) for conditional classes.
  - Avoid using the `@apply` directive in CSS files unless creating a global base style.


## Component Architecture & Decomposition
- **Modularization Rule:** DO NOT create single component files exceeding 300 lines.
- **Mandatory Extraction:** If a component contains a Modal, Table, or Form, that sub-component MUST be extracted into its own file.
- **No Inline Modals:** Never define modal content within a page or parent component file.
- **No Alerts:** When making a simple confirmation or notification alert, make it into a modal using a standard confirm modal window.  

## File Structure
- **Modals:** All modals must live in `web/components/modals/[ModalName].tsx`.
- **Tables:** All complex tables must live in `web/components/tables/[TableName].tsx`.
- **Pages:** `web/pages/` should only contain high-level layout and data-fetching logic; UI details must be delegated to components.

## Component Naming
- **Files:** Use PascalCase for all component files (e.g., `UserTable.tsx`).
- **Exports:** Use named exports for all components.
- **Props:** Define component props in a matching `.types.ts` file if they exceed 5 properties.