# Visual thesis — The words after dusk

## Direction and rationale

**Cinematic environmental art.** Recall is treated as returning to a place, not turning over a generic flashcard. The app lives at blue hour: a quiet conservatory-workroom where small illuminated objects hold personal sentences. Warm paper and ember light pull the task forward while the surrounding deep teal stays quiet. This fits a private, reflective practice and makes the learner's own context feel like the protagonist.

This is an explicitly single-mode visual world. It paints every background rather than inheriting an OS theme: a deep night shell around warm, high-contrast writing and practice surfaces. A second light theme would break the scene continuity and add glare during listen/speak practice.

## Tokens

- `night-950 #081315` — page background; the outside world
- `night-900 #0D1B1D` — raised navigation/surfaces
- `night-800 #173033` — borders and quiet controls
- `paper-100 #F3EAD6` — primary text and practice paper
- `paper-300 #D8CDB5` — secondary text (tested against night at ≥ 7:1)
- `ember-500 #EE8151` — primary action and focus; dark ink text on filled actions
- `ember-300 #FFB08D` — links and small highlights
- `moss-400 #93B788` — success/due-complete state
- `gold-400 #E4B85A` — warnings/offline
- `red-400 #F28B82` — destructive/error states

Surfaces use solid color, narrow internal highlights, soft projected shadows, and subtle grain. No generic gradients or glassmorphism.

## Typography

- Display/context: Georgia, `Iowan Old Style`, serif. It evokes marginalia and gives a learner-written sentence dignity.
- Interface/data: Inter-compatible system sans stack (`ui-sans-serif`, `system-ui`). It stays neutral and loads with zero font bytes or third-party requests.
- Scale: 0.78rem metadata, 0.9rem label, 1rem body, 1.25rem subhead, clamp(2–3.8rem) display. Body minimum is 16px. Long text measures 42–68ch at 1.55 leading. Counts use tabular figures.

## Spacing and shape

An 8px base rhythm with 4px for micro gaps: 4, 8, 12, 16, 24, 32, 48, 64. Main content caps at 1120px. Controls are at least 44px high and have 8px separation. Corners use 10px for controls, 18px for independent cards, and a clipped/notched upper corner on practice paper to suggest a physical field note.

At 390px, the wide navigation becomes a bottom dock, the scene image becomes a shallow atmospheric header, form columns stack, and secondary explanations collapse behind plain-language disclosures. The current task and its action remain above the fold.

## Interaction grammar

- Add/import actions arrive from the writing-desk side of the scene (a short 12px rise).
- Practice steps advance left-to-right like moving through adjacent rooms: **Listen → Cloze → Speak**.
- A card's original context is revealed by lifting a paper shutter, using opacity and 8px translation.
- Every recording state pairs color with label, timer, and icon. Destructive deletion is confirmed; review grading gives immediate schedule feedback.
- Focus is a 3px ember outline with 3px clearance. Hover is never the only cue.

## Motion policy

UI transitions run 180–240ms and animate only opacity/transform. The hero has a one-time, 600ms settle; nothing loops. Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed, transitions collapse to near-instant opacity, and timers remain text-only.

## Asset plan and provenance

### `assets/src/recall-room.png` / responsive WebP derivatives

- Use case: cinematic landing/empty-state hero; it explains that words are anchored to lived environments.
- Subject/world: unoccupied night conservatory-workroom after rain, small writing desk, open blank field notebook, compact recorder, three pools of practical light leading into the depth, blurred foreign-city street outside.
- Materials: rain-streaked glass, dark teal painted wood, worn paper, brushed metal, moss, dust in light.
- Light/lens: blue-hour ambient light with warm tungsten practicals; 35mm cinematic lens, shallow but readable depth.
- Palette words: deep petrol, ink green, parchment, ember, soft moss.
- Negative list: people, hands, faces, text, letters, logos, brands, UI, floating cards, neon cyberpunk, oversaturation, watermarks.
- Prompt: “Cinematic environmental concept art for a private language recall journal, an unoccupied glass conservatory-workroom at blue hour after rain, a small dark-wood writing desk holding an open completely blank field notebook and a compact unbranded voice recorder, three warm pools of practical tungsten light receding into the room as a subtle listen–remember–speak path, rain-streaked windows with a softly blurred old-city street beyond, moss and paper textures, deep petrol and ink-green shadows, parchment and ember highlights, 35mm lens, quiet intimate atmosphere, editorial realism, wide composition with clear dark negative space on the left, no people, no hands, no readable text, no letters, no symbols, no logos, no watermark, no app interface, no floating cards, no neon cyberpunk.”
- Generated with the factory Azure image deployment via `/opt/fleet/lib/gen-image.sh`, 2026-08-28. Original output is AI-generated and owned for this product. The footer discloses generated imagery.

App icons and interface symbols are original hand-authored SVG geometry (simple flame/voice-wave motif), MIT licensed with the repository.
