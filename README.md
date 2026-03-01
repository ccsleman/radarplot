# Radar Maritime Plotting

Radar plotting tool for maritime collision avoidance. Computes CPA, TCPA, and true target motion from two observed positions.

## Running

Requires a local server (ES modules don't work over `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

## Shareable URLs

The full application state is encoded in the URL fragment hash. As you edit values, the URL updates automatically. Use the **Copier le lien** button (top-right corner) to copy a shareable link to your clipboard.

### Parameters

| Key | Description | Format |
|---|---|---|
| `oc` | Own ship course | degrees |
| `os` | Own ship speed | knots |
| `t` | Selected target | 1–5 |
| `N.b1` | Target N bearing (position 1) | degrees |
| `N.d1` | Target N distance (position 1) | NM |
| `N.t1` | Target N time (position 1) | HHMM |
| `N.b2` | Target N bearing (position 2) | degrees |
| `N.d2` | Target N distance (position 2) | NM |
| `N.t2` | Target N time (position 2) | HHMM |
| `ac` | Avoidance course | degrees |
| `as` | Avoidance speed | knots |
| `ad` | Avoidance distance | NM |

Targets are 1-indexed: `N` ranges from 1 to 5, matching the button labels in the UI. Avoidance keys are only present when avoidance is active. Any parameter omitted from the URL keeps its default value.

### Example

```
index.html#oc=90&os=15&t=1&1.b1=45&1.d1=8&1.t1=1200&1.b2=50&1.d2=6&1.t2=1212
```

## Tests

Requires Node 18+. No dependencies.

```bash
node --test tests/bearings.test.js tests/calculator.test.js tests/animation.test.js
```
