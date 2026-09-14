# Simply Static export

Keep the WordPress Simply Static zip and extracted site here so later sessions can compare the rebuild against the original.

## Layout

```
_import/
  README.md
  simply-static.zip          # original export zip (do not delete)
  simply-static/             # extracted export used for visual comparison
```

## Preview the export

From the repo root:

```bash
python -m http.server 8082 --directory _import/simply-static
```

Then open http://localhost:8082/ next to the rebuild at http://localhost:8081/.
