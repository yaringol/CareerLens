# CareerLens — Brand Guide (fidelity source for the promo video)

Extracted verbatim from the product's own design tokens: `frontend/src/index.css` (`:root`)
and `frontend/src/components/ui/AppLogo.tsx`. These are not approximations — they are the
values the shipping product renders with.

## Logo / wordmark

File: `01-logo-careerlens.svg` (vector, exported from the live React component).

- **Mark**: a document outline (rounded rect, folded top-right corner, two text lines inside)
  with a magnifying glass overlapping its lower-right corner. The glass's inner dot is the
  only filled element, in accent violet.
- **Wordmark**: `Career` in weight **800**, `Lens` in weight **300**, separated by a single
  space. Letter-spacing `-0.02em`.
- **Colors**: mark + `Career` = `#1e1b6e`. `Lens` = `#9b8ec4`. Lens dot = `#8b7cf6`.
- **Strokes**: 2.5–3.5px at a 56×56 viewBox, round caps and joins. Never fill the mark.
- **Do not**: recolor the wordmark to a gradient, add a drop shadow, outline the text,
  place the mark inside a circle/badge, or separate the glass from the document.

## Color palette

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#eeeef8` | Page background — the film's "light" world |
| `--color-primary` | `#1e1b6e` | Deep indigo. Text, logo, dark backgrounds |
| `--color-accent-start` | `#8b7cf6` | Primary violet — CTAs, active state, glow |
| `--color-accent-end` | `#c084fc` | Light violet — gradient end only |
| `--color-secondary` | `#9b8ec4` | Muted lavender, secondary text |
| `--color-surface` | `#ffffff` | Cards |
| `--color-success` | `#10b981` | Green — completed steps, `EXCELLENT` |
| `--color-warning` | `#f59e0b` | Amber — `GOOD` / `MODERATE` score arc |
| `--color-error` | `#ef4444` | Red — `WEAK` score arc, missing skills |

Accent gradient: `linear-gradient(135deg, #8b7cf6, #c084fc)` — used on primary buttons and
on the circular score gauge.

## Typography

**Inter** (fallback: system-ui, Helvetica, Arial). Base 16px, line-height 1.5.
Headings 700–800. The wordmark's 800/300 contrast is the brand's signature — mirror it in
on-screen titles: bold statement + light qualifier.

## Geometry & depth

Card radius `12px`, input `8px`, badge `6px`, pills fully rounded.
Shadows are indigo-tinted and soft, never neutral gray:
`0 1px 3px rgba(30,27,110,.08), 0 4px 16px rgba(30,27,110,.06)`.

## Tone

Diagnostic, not salesy. The product tells people what the market data says about their CV —
including when the answer is `30% · WEAK`. The film should be honest in the same way: show a
real low score before showing the improvement.
