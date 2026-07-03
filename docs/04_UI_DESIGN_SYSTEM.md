# 04. UI Design System

## 1. Core Principles
- **Clarity over Cleverness**: Enterprise tools should be predictable.
- **Consistency**: Buttons, inputs, and cards must look and behave the same everywhere.
- **Feedback**: Every action (click, submit, error) must have a visual response (toast, spinner, state change).

## 2. Design Tokens

### 2.1 Colors
- **Primary**: ResKonnect Gold (#EAB308) - Used for primary CTAs and accents.
- **Secondary**: Slate-600/700 - Used for navigation and secondary text.
- **Success**: Emerald-500/600 - Used for approvals and active statuses.
- **Warning**: Amber-500/600 - Used for pending states and alerts.
- **Destructive**: Rose-500/600 - Used for errors and rejections.

### 2.2 Typography
- **Font Family**: `Inter` or `Geist` (Modern sans-serif).
- **Scale**:
  - `h1`: 30px / 36px line-height / Bold.
  - `h2`: 24px / 32px line-height / SemiBold.
  - `h3`: 20px / 28px line-height / SemiBold.
  - `Body`: 16px / 24px line-height / Regular.
  - `Small`: 14px / 20px line-height / Medium.

### 2.3 Spacing (Tailwind-based)
- **Base**: 4px (`1 unit`)
- **Container**: `px-4 sm:px-6 lg:px-8`
- **Sections**: `py-8 md:py-12`
- **Components**: `gap-4`, `p-6` for cards.

## 3. Component Standards
- **Cards**: Minimalist, white or subtle slate backgrounds, rounded corners (`rounded-xl`), light shadow on hover for interactivity.
- **Tables**: `shadcn/ui` data-table implementation. Sticky headers for long lists. Row actions via dropdown menus.
- **Badges**:
  - `Default`: Slate/Gray.
  - `Success`: Emerald (Accredited/Approved).
  - `Warning`: Amber (Pending/Review).
  - `Destructive`: Rose (Rejected/Full).
- **Buttons**:
  - `Primary`: Gold/Yellow (Main action).
  - `Secondary`: Slate/Outline (Secondary action).
  - `Ghost`: Icon buttons and less important links.
- **Forms**: Vertical layout by default. Required fields marked with red asterisks. Inline validation on blur.

## 4. Interaction States
- **Loading**: Use Skeletons for structural content; Spinners for inline actions.
- **Empty States**: Icon + Heading + Descriptive text + Primary Action Button.
- **Error States**: Inline alerts for field-specific errors; Toasts for global failures.

## 5. Accessibility (A11y)
- High contrast for text.
- ARIA labels for icon-only buttons.
- Keyboard navigability for all forms and interactive lists.
