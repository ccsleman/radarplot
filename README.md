# Radar Maritime Plotting

Radar plotting tool for maritime collision avoidance. Computes CPA, TCPA, and true target motion from two observed positions.

## Running

Requires a local server (ES modules don't work over `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

## Tests

Requires Node 18+. No dependencies.

```bash
node --test tests/bearings.test.js tests/calculator.test.js
```
