# 209 birthdays — React rewrite

This page used to be hand-written DOM code (`view/birthdays-renderer.ts`, deleted). It's now React, kept as close to the original file-for-file as the framework allows. `models/` and `services/` are untouched — only the *view* changed.

## Vanilla → React, concept by concept

| Vanilla (`BirthdaysRenderer`)                                    | React                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `class BirthdaysRenderer extends EventTarget`                      | A tree of components: `BirthdaysApp`, `ScrollPicker`, `SelectionDisplay`, `NotificationsToggle` |
| `initialize()` + `container.getElementAsync(...)`                  | Not needed — JSX *is* the DOM description; React creates the elements, you never query for them |
| Class fields (`#members`, `#memberSelection`, …)                   | `useState` — a value that, when changed, re-renders the component      |
| `#pairMemberWithButton`, `#buttonPickerSelection` (mutable refs to real DOM nodes) | `useRef` — same idea, a mutable box React won't re-render on           |
| `dispatchEvent(new CustomEvent("selectionchange", …))`             | A callback prop: `onSelect(member)`, passed down from the parent       |
| `addEventListener("selectionchange", …)` on the controller         | The parent just passes a function as a prop; no event bus needed       |
| `#initializeListeners()` (runs once after `initialize()`)          | `useEffect(() => { … }, [])` — runs once after the component mounts    |
| `Timer` (`EventTarget`) driving the wish/countdown cycle           | Still the same `Timer` class — a `useEffect` subscribes to its `"trigger"` event, same as before |
| `AppController.run()` wiring everything together                  | `AppController.run()` still exists — it loads the data, then does one new thing: `createRoot(divRoot).render(<BirthdaysApp members={members} />)` |

## Where it's genuinely React-specific

- **`view/scroll-picker.tsx`** — the scroll-snap highlighting still touches the DOM directly (`classList.add("selected")`, `scrollIntoView(...)`) inside a `useEffect`, exactly like the old code. This is deliberate: React re-rendering the whole list on every scroll tick would be wasteful and would fight the browser's native scroll-snap behaviour, so this component stays imperative underneath a React shell. The `refOnSelect`/`refOnCommit` refs exist only so the mount-once effect always calls the *latest* callback prop without needing to re-run on every render.
- **`view/selection-display.tsx`** — same reasoning: the fade-out-then-swap-text-then-fade-in animation needs old and new text sequenced through a `finish` callback, which is awkward to express as "render this JSX" (React would swap the text the instant the prop changes, before the fade-out finishes). So it keeps writing `textContent` by hand inside `useEffect(() => { … }, [content])`.
- **`view/birthdays-app.tsx`** — `useSelectionContent` is a custom hook: a function starting with `use` that bundles the generator + `Timer` logic from the old `#updateSelection`/`#onTimerTrigger` pair into one reusable unit.
- **`controllers/app-controller.tsx`** wraps the app in `<StrictMode>`. In dev only, StrictMode runs effects twice to catch code that isn't safe to run more than once. The notification bootstrap effect firing its POST twice locally is expected and harmless — `NotificationService.synchronize()` is idempotent by design (see its docstring).
