<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/LightLogo.png">
    <source media="(prefers-color-scheme: light)" srcset="public/DarkLogo.png">
    <img alt="BenchLedger" src="public/DarkLogo.png" width="720">
  </picture>
</p>

# BenchLedger

Store, query, and visualize benchmark history.

It is designed for library performance tracking: run benchmarks elsewhere, write the results to SQLite, and use BenchLedger to inspect trends, run context, and benchmark deltas directly in the browser.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
