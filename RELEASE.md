# Releasing

Development happens in the private working repos; public releases are
**clean exports with their own history** (the dev history contains working
notes, screenshots and internal infrastructure references — it stays private
by design).

## Workflow

```bash
# 1. develop + commit in the private repos as usual (brain-galaxy, brain-indexer)

# 2. cut a release:
bash scripts/export-public.sh ../brain-galaxy-public v0.2.0
cd ../brain-indexer && bash export-public.sh ../brain-indexer-public v0.2.0

# 3. audit the export (hostnames / IPs / personal references):
grep -riE '<your-host-patterns>' ../brain-galaxy-public || echo clean

# 4. publish (first time: git remote add origin …):
cd ../brain-galaxy-public  && git push origin main --tags
cd ../brain-indexer-public && git push origin main --tags
```

Re-running the export script commits whatever changed since the last export
(or reports „no changes"); a release name (`v0.2.0`) becomes commit message
and annotated tag.

## Rules

- Screenshots in `docs/assets/` only from demo or synthetic data
  (`make_synth_vault.py`) — never personal vault content.
- Never commit secrets; integration credentials live in gitignored env
  files (`.env.example` documents the variables).
- Breaking API/index changes bump the schema version (`schema_version`) —
  consumers check it.
