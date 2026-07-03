# 04. UI Design System

## 1. Core Principles
- **Clarity over Cleverness**: Enterprise tools should be predictable.
- **Consistency**: Buttons, inputs, and cards must look and behave the same everywhere.
- **Feedback**: Every action (click, submit, error) must have a visual response (toast, spinner, state change).

## 2. Design Tokens
- **Colors**:
  - `Primary`: ResKonnect Gold/Primary (#EAB308)
  - `Secondary`: Slate/Neutral tones.
  - `Success`: Emerald/Green.
  - `Destructive`: Rose/Red.
  - `Warning`: Amber/Orange.
- **Typography**:
  - `Headings`: Sans-serif (Inter/Geist), Bold.
  - `Body`: Standard sans-serif, Regular (400) for prose, Medium (500) for labels.
- **Spacing**: 4px base (tailwind units: `p-1`, `p-2`, `p-4`, `p-6`).

## 3. Component Standards
- **Cards**: Minimalist, subtle border, rounded corners (`rounded-xl`).
- **Tables**: `shadcn/ui` based, sortable columns, pagination for >20 items.
- **Badges**: Small, semi-transparent backgrounds with high-contrast text.
- **Forms**: Grouped fields with clear labels, helpful placeholders, and validation messages.

## 4. Interaction States
- **Loading**: Use Skeletons for structural content; Spinners for inline actions.
- **Empty States**: Icon + Heading + Descriptive text + Primary Action Button.
- **Error States**: Inline alerts for field-specific errors; Toasts for global failures.

## 5. Accessibility (A11y)
- High contrast for text.
- ARIA labels for icon-only buttons.
- Keyboard navigability for all forms and interactive lists.
