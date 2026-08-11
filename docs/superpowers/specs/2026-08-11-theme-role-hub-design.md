# Telegram theme converter: semantic role hub

## Context

Converting a Desktop theme to Android produced a visibly broken theme: action-bar icons invisible against the action bar, a compose FAB rendered as a dark disc on a dark background, invisible Cancel/Apply buttons, avatar initials in the wrong color, an unreadable reply-quote panel, and a warm-orange subtitle.

The root cause was structural. `resources/data/telegram-conversion-rules.json` paired all 586 Desktop keys 1:1 with 586 of the 759 Android keys as a bijection, chosen so that `Desktop -> Android -> Desktop` would round-trip byte-identically - not because the paired keys meant the same thing. A prior investigation (2026-08-10) measured 461 of the 586 pairs (79%) joining colors that are unrelated in the official palettes, and decided visual correctness should beat round-trip losslessness, with mappings hand-authored rather than generated. That decision was recorded but never implemented; this change implements it.

Governing constraint: accuracy is never traded away for a smaller diff, elegance, or a lossless round trip.

## The shape of the fix

The Desktop<->Android pair table is replaced by a platform-neutral role hub. Each platform gets exactly one binding table (`key -> role`). Conversion lifts the source theme's keys into role values, then projects those role values onto the target platform's keys. Adding iOS or macOS later costs one vocabulary and one binding table, touching nothing existing.

**Copy only, no computed colors.** Every projected value is a verbatim copy of a lifted role value - no transform, no synthesis. The invisible-element defects were wrong pairings, not missing colors: Desktop already stores the FAB icon color as `activeButtonFg`; the fix binds it and Android's `chats_actionIcon` to the same role.

**Role inheritance, no fabricated defaults.** Roles form a tree; all but a small set of roots name a parent. A target key whose own role holds no lifted value copies the nearest populated ancestor. Every root has an authority binding on both platforms, guaranteeing the walk always terminates on a real color taken from the source theme - never a vocabulary default. This also structurally removes the previous bug where a missing key was backfilled from the *light* default even when converting a dark theme.

**Authority keys.** At most one key per (platform, role) is the authority - the reader lifting reads from. Every other key bound to that role is write-only. This makes the many-to-one binding unambiguous and gives an exact round-trip guarantee, but only for roles with an authority binding on *both* platforms - the plan's original wording overstated this to "every authority key"; the true, mechanically-guaranteed invariant is narrower, and the test suite asserts the narrower one.

## Data files

`resources/data/telegram-theme-roles.json` - 37 roles: 15 structural roots (`surface.primary`, `surface.chrome`, `surface.overlay`, `surface.bubble.in/out`, `text.primary/secondary/hint`, `accent.primary`, `text.onAccent`, `border.default`, `shadow.default`, `status.error/success`, `overlay.scrim`), 9 palette roots (`palette.blue/green/red/golden/lightblue/lightgreen/orange/purple/cyan`), and 13 children covering the screenshot-implicated surfaces (action bar/title bar, chat list/FAB/avatar/dialog buttons, reply quotes, media/audio/loaders).

`resources/data/telegram-android-bindings.json` and `telegram-desktop-bindings.json` - every platform key (759 Android, 586 Desktop) bound to exactly one role, with an explicit `authority` flag.

`resources/data/telegram-conversion-rules.json` is deleted.

### Authoring method and the light-default oracle

Root and child authority pairs were chosen by reasoning about what each key means, then checked against a real cross-platform oracle: both vocabularies carry the platforms' own official light-theme defaults, and semantically equivalent keys agree on them closely (`chat_outBubble` `#efffde` vs `msgOutBg` `#effdde`; `windowBackgroundWhite` `#ffffff` vs `windowBg` `#ffffff`). A perceptual-distance (CIE76 ΔE) check against this oracle, run during authoring, caught six wrong pairings before they shipped - among them a title-text root pairing that scored ΔE 59.8 (Desktop's OS-window title text is deliberately muted; the in-chat header text needed `windowBoldFg` instead), and a reply-quote author pairing that scored ΔE 96.7 (Desktop's `historyPeer1NameFg` is a rotating per-member color, not a fixed "reply author" slot). All were corrected; one exception remains and is documented inline in the test file (`border.default`: Desktop's only literally-named divider key stores an opaque black that Telegram composites at a runtime opacity the palette file does not record).

The remaining ~1250 keys not covered by a hand-picked pairing are bound to the nearest matching root by a name-pattern classifier - itself a set of authored judgments about what a substring means (`"error"` -> `status.error`, `"hint"`/`"placeholder"` -> `text.hint`, etc.), applied mechanically for volume rather than typed out 1250 times. This is coarser than the hand-picked pairs but never fabricates a color: an unmapped key still inherits a real, semantically-chosen root's lifted value.

## Code changes

New models (`telegram-theme-converter/models/`): `role.ts`, `role-vocabulary.ts` (role graph, cycle detection, root-ward chain walk), `binding.ts`, `binding-table.ts` (key/role/authority indices), `platform.ts` (`Platform` abstract base plus `AndroidPlatform`/`DesktopPlatform` - the seam a future iOS/macOS platform plugs into). `rule.ts` and `rule-table.ts` are deleted.

New services (`telegram-theme-converter/services/`): `color-metrics.ts` (WCAG relative luminance, contrast ratio, CIE76 ΔE - `adaptive-extender`'s `Color.lightness` is HSL lightness, not luminance, and is wrong for polarity/contrast), `polarity.ts`, `lifter.ts`, `projector.ts`.

`services/converter.ts` is now platform-agnostic: `convert(theme, from, to)` composes lift then project. `models/report.ts` outcomes are `bound` / `inherited` / `unread`, replacing `direct` / `anchored` / `dropped`. `controllers/app-controller.ts` resolves a `Platform` by extension instead of branching on an enum, and `DesktopPlatform.parse` is now polarity-aware: it parses once with a light seed, detects polarity from the resolved `surface.primary` authority key, and re-parses with a dark seed if the theme turns out dark - closing the previous always-light-seed gap for symbolic palette references in dark `.tdesktop-theme` files.

`index.html` no longer claims "Perfect two-way conversion" - that guarantee no longer holds and must not be claimed.

## Verification

`tests/telegram-theme-converter/converter.test.ts` (40 tests, rewritten): role graph acyclicity and root dual-authority; binding table completeness (every vocabulary key bound, every role real); no duplicate authority per (platform, role); the light-default oracle (ΔE <= 30, one documented exception); dark-default divergence reported but not gated; opacity-class agreement; completeness (every conversion emits the full target key set); a partial theme missing a root authority key throws rather than fabricating; round-trip identity on dual-authority roles only; and a named test per screenshot defect (D1-D9) asserting WCAG-style contrast on the actual converted fixture output.

`npm run typecheck` and `npm run test` (build + vitest) both pass.

## What's authored precisely vs. inherited coarsely

Precisely authored, verified against the oracle, and defect-tested: action bar/title bar, chat list unread badges, the FAB and its icon, avatar initials, dialog flat buttons, reply-quote bar/author/text, and audio/loader text and progress indicators - i.e. every surface shown broken in the reported screenshots.

Inherited from a root via the coarse name-pattern classifier, and not yet individually reviewed: settings, profile, calls, group calls, polls, premium, statistics charts (beyond the palette-hue roots), and stories. These are structurally safe - never fabricated, never invisible - but not verified surface-by-surface. Refining them is future work, phased by UI surface the same way the screenshot-implicated surfaces were.
