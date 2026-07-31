# ClubFlow Design System v2 — Developer Usage Guide

This document outlines how to build interfaces in ClubFlow using our shared UI primitives and Tailwind tokens.

## Guiding Principle
**Do not invent new layouts or components.** Re-use the existing primitives from `src/components/ui/` to ensure absolute consistency across all 40+ modules.

## Typography
Use the global semantic typography classes rather than manual Tailwind text sizing:
- **`cf-page-title`**: For the main `H1` at the top of a module.
- **`cf-section-title`**: For major sub-sections (`H2`).
- **`cf-card-title`**: For the headers of standard cards (`H3`).
- **`cf-body`**: For standard paragraph text and table cell data.
- **`cf-metadata`**: For secondary descriptions, timestamps, or subtitle text.
- **`cf-label`**: For form labels and badge text (Uppercase).
- **`cf-table-header`**: For table header cells (`<th>`).
- **`cf-helper-text`**: For form hints.

## Colors & Backgrounds
We use semantic CSS variables mapped through Tailwind:
- `bg-background`: The deepest background layer (Zinc 950). Used for the main app background and recessed inputs.
- `bg-card` / `bg-surface-1`: Used for standard cards and panels (Zinc 900).
- `bg-popover` / `bg-surface-2`: Used for elevated elements like dropdowns and modals (Zinc 800).
- `bg-primary`: Brand Crimson. Use **strictly** for the primary action button on a page.
- `text-foreground`: Primary white text (`#FAFAFA`).
- `text-muted-foreground`: Muted grey text for labels and secondary data.

## Structural Rules
- **Cards**: Use the `<Card>` component. Do not manually apply borders or shadows to `<div>` elements to recreate a card.
- **Buttons**: Use `<Button>`. Use `variant="default"` (Crimson) only for the primary action. Use `variant="secondary"` or `variant="ghost"` for all other actions.
- **Inputs**: Use `<Input>`. It automatically applies the recessed background and focus ring.
- **Spacing**: Use standard Tailwind spacing classes (multiples of 4, corresponding to an 8pt grid). 
- **Borders & Radiuses**: The global `--radius` is set to 4px. Use standard `rounded` and `border-border` classes. Do not use drop shadows for layout structure.

## Page Architecture
Every module should follow this structure:
1. **Page Title** (`cf-page-title`)
2. **One sentence description** (`cf-metadata`)
3. **Primary Actions** (e.g. `<Button>Add Player</Button>`)
4. **KPI Cards** (Optional high-level metrics)
5. **Filters & Search**
6. **Primary Content** (e.g. `<Table>`)

For examples, check the components in `src/components/ui/`.
