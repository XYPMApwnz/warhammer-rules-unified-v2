# Warhammer Rules Unified — Visual v2

Separate visual study built from `warhammer-rules-unified` without changing the accepted v1 folder or its Git history.

## Intent

- Keep the library's underhive metal, parchment typography and square geometry.
- Keep Death Guard v4 navigation, popup, Journey/Back and search behavior unchanged.
- Keep the army's green and pink colour scheme as faction identity.
- Use one root manifest and one root service worker.

## Structure

- `index.html` — shared library.
- `books/death-guard/` — Death Guard v4 engine with the v2 industrial skin.
- `books/death-guard/docs/VISUAL_CONTRACT_V2.md` — visual rules for future books.
- `tests/` — inherited reader checks and integration contracts.

## Run

Open `index.html` for a local preview. PWA and offline behavior require HTTP hosting.

```powershell
npm test
```

The Death Guard card opens `books/death-guard/index.html`; Library returns to the shared home screen over both `file://` and HTTP.
