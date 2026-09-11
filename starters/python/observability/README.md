# Slack error alerting — RITIRATO ▸ usa `nesso-notify`

> ⚠️ **Questo starter è ritirato (WS1, 2026-07).** È stato assorbito nella
> libreria pubblicata **`nesso-notify` v0.2.0**, che ne è il superset (stessi
> hook auto-attach + anti-flood throttle + guardie, più `.env` autodiscovery e
> `notify()`). Non copiare più `slack_alerts.py` — **installa il pacchetto.**

## Uso

```toml
# pyproject.toml / requirements.txt
nesso-notify @ git+https://github.com/nesso-labs/nesso-notify@v0.2.0
```

```python
from nesso_notify import attach_error_alerts, send_error_alert, notify

attach_error_alerts()   # auto-hook stdlib + loguru + Celery (opt-in)
send_error_alert("ingest", "fetch fallito", error=exc, severity="critical")
```

Install privato in CI/Docker via il secret d'org `NESSO_PACKAGES_TOKEN`:

```yaml
- run: git config --global url."https://x-access-token:${{ secrets.NESSO_PACKAGES_TOKEN }}@github.com/".insteadOf "https://github.com/"
```

## ⚠️ Gating (cambio rispetto allo starter always-on)

`attach_error_alerts()` è **opt-in**: non aggancia nulla se
`ENABLE_SLACK_NOTIFICATION` non è truthy. Lo starter era always-on quando il
webhook era settato → **imposta `ENABLE_SLACK_NOTIFICATION=true`** nell'env di
deploy, altrimenti gli alert spariscono silenziosamente. `ENABLE_SLACK_ERROR_ALERTS`
gate solo l'auto-hook, non `send_error_alert()` esplicito. Env + API completi
nel README/CHANGELOG di `nesso-notify`.

Storia: distillato dai rollout `nesso-tenders-scraper` PR #450 e
`nesso-tenders-be` PR #744, poi unificato in `nesso-notify` 0.2.0.
