# Linkumori WCAG 2.2 AA Checklist

This project uses WCAG 2.2 Level AA as its accessibility baseline. WCAG 2.2 is the current W3C Recommendation for WCAG 2, and Level AA includes every Level A and Level AA success criterion.

This file is an implementation checklist, not a conformance claim. A release should only claim WCAG 2.2 AA conformance after human testing with keyboard-only operation, browser zoom/reflow, screen reader checks, color contrast measurement, and user-flow testing across all extension pages.

Sources:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/quickref/
- https://www.w3.org/WAI/WCAG2AA-Conformance

## Project Rules

- Every meaningful icon, image, SVG, canvas, or generated visual needs a text alternative. Decorative visuals must be hidden from assistive technology.
- All controls must work with keyboard only. Custom controls need a correct role, focusability, visible focus, keyboard activation, and current state.
- Labels, visible text, accessible names, and tooltips must describe the same action. Icon buttons need an accessible name.
- Targets must be at least 24 by 24 CSS pixels, or have enough spacing to satisfy WCAG 2.2 target-size minimum.
- Text, controls, focus outlines, borders, and state indicators must meet AA contrast requirements in every supported theme.
- Dynamic status and validation messages must be announced with `role="status"` or another appropriate live region.
- Do not use color alone to communicate state; include text, shape, aria state, or another non-color cue.
- Pages must remain usable at 200% text zoom and in narrow responsive layouts without two-dimensional scrolling for normal reading.

## WCAG 2.2 A and AA Success Criteria

### 1. Perceivable

- 1.1.1 Non-text Content (A): provide text alternatives or mark decorative content as decorative.
- 1.2.1 Audio-only and Video-only, Prerecorded (A): provide an equivalent alternative for prerecorded audio-only or video-only media.
- 1.2.2 Captions, Prerecorded (A): provide captions for prerecorded synchronized media.
- 1.2.3 Audio Description or Media Alternative, Prerecorded (A): provide audio description or an equivalent media alternative.
- 1.2.4 Captions, Live (AA): provide captions for live synchronized media.
- 1.2.5 Audio Description, Prerecorded (AA): provide audio description for prerecorded synchronized media.
- 1.3.1 Info and Relationships (A): expose structure, labels, relationships, and grouping programmatically.
- 1.3.2 Meaningful Sequence (A): keep reading and focus sequence meaningful.
- 1.3.3 Sensory Characteristics (A): do not rely only on shape, color, size, visual position, orientation, or sound.
- 1.3.4 Orientation (AA): do not lock content to one display orientation unless essential.
- 1.3.5 Identify Input Purpose (AA): use programmatic autocomplete/input-purpose hints where user data is collected.
- 1.4.1 Use of Color (A): do not rely on color alone.
- 1.4.2 Audio Control (A): provide control for audio that starts automatically and lasts more than three seconds.
- 1.4.3 Contrast Minimum (AA): normal text needs at least 4.5:1 contrast; large text needs at least 3:1.
- 1.4.4 Resize Text (AA): support text resize to 200% without loss of content or function.
- 1.4.5 Images of Text (AA): avoid images of text unless essential or user-customizable.
- 1.4.10 Reflow (AA): support 320 CSS px width without loss of content or function except where two-dimensional layout is essential.
- 1.4.11 Non-text Contrast (AA): UI component boundaries and meaningful graphics need at least 3:1 contrast.
- 1.4.12 Text Spacing (AA): content must remain usable when users increase line, paragraph, letter, and word spacing.
- 1.4.13 Content on Hover or Focus (AA): hover/focus content must be dismissible, hoverable, and persistent when needed.

### 2. Operable

- 2.1.1 Keyboard (A): all functionality must work by keyboard.
- 2.1.2 No Keyboard Trap (A): keyboard focus must not get trapped.
- 2.1.4 Character Key Shortcuts (A): single-character shortcuts must be off, remappable, or active only on focus.
- 2.2.1 Timing Adjustable (A): users need control over time limits unless an exception applies.
- 2.2.2 Pause, Stop, Hide (A): moving, blinking, scrolling, or auto-updating content needs controls.
- 2.3.1 Three Flashes or Below Threshold (A): avoid flashing content above seizure thresholds.
- 2.4.1 Bypass Blocks (A): provide a way to bypass repeated blocks where applicable.
- 2.4.2 Page Titled (A): each page needs a useful title.
- 2.4.3 Focus Order (A): focus order must preserve meaning and operation.
- 2.4.4 Link Purpose, In Context (A): link purpose must be clear from text or context.
- 2.4.5 Multiple Ways (AA): provide more than one way to locate pages in a set, unless exempt.
- 2.4.6 Headings and Labels (AA): headings and labels must describe topic or purpose.
- 2.4.7 Focus Visible (AA): keyboard focus must be visible.
- 2.4.11 Focus Not Obscured, Minimum (AA): focused controls must not be entirely hidden by author-created content.
- 2.5.1 Pointer Gestures (A): multipoint or path-based gestures need a single-pointer alternative unless essential.
- 2.5.2 Pointer Cancellation (A): pointer actions must avoid accidental activation or provide undo/cancel behavior.
- 2.5.3 Label in Name (A): accessible names must include visible label text.
- 2.5.4 Motion Actuation (A): motion-triggered functions need a non-motion alternative and a way to disable motion activation.
- 2.5.7 Dragging Movements (AA): dragging must have a non-dragging alternative unless essential.
- 2.5.8 Target Size Minimum (AA): pointer targets need a 24 by 24 CSS px target or enough spacing unless an exception applies.

### 3. Understandable

- 3.1.1 Language of Page (A): set the page language.
- 3.1.2 Language of Parts (AA): mark passages in another language when needed.
- 3.2.1 On Focus (A): focusing a control must not unexpectedly change context.
- 3.2.2 On Input (A): changing a form value must not unexpectedly change context.
- 3.2.3 Consistent Navigation (AA): repeated navigation must stay in a consistent order.
- 3.2.4 Consistent Identification (AA): repeated components must be identified consistently.
- 3.2.6 Consistent Help (A): help mechanisms repeated across pages must appear in the same relative order.
- 3.3.1 Error Identification (A): input errors must be identified and described.
- 3.3.2 Labels or Instructions (A): inputs need labels or instructions.
- 3.3.3 Error Suggestion (AA): suggest corrections when known and safe.
- 3.3.4 Error Prevention, Legal, Financial, Data (AA): risky submissions need review, confirmation, reversibility, or validation.
- 3.3.7 Redundant Entry (A): do not require users to re-enter information already provided in the same process unless necessary.
- 3.3.8 Accessible Authentication Minimum (AA): authentication must not rely on a cognitive function test unless an accessible alternative exists.

### 4. Robust

- 4.1.2 Name, Role, Value (A): custom controls must expose their name, role, value, and state.
- 4.1.3 Status Messages (AA): status messages must be programmatically determinable without moving focus.

## Current Linkumori Implementation Notes

- Settings theme cards are implemented as two radio groups: one for preferred light themes and one for preferred dark themes.
- Settings toggle switches expose `role="switch"`, `aria-checked`, labels, descriptions, and keyboard activation.
- Settings status messages use a polite live region.
- Decorative settings SVGs are hidden from assistive technology.
- A full AA audit still needs contrast measurements for every theme and manual checks across popup, settings, legal, report, audit, log, guide, blocked-site, regression, and custom-rules pages.
