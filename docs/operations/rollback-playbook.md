# Rollback Playbook

> Step-by-step procedures for rolling back a failed production deployment.
>
> **Read this before you need it.** Familiarise yourself with the procedures during a quiet period, not during an incident.

---

## 0. Decision Matrix

| Symptom | Action |
|---------|--------|
| New deployment is rolling — Swarm health checks failing | Wait: Swarm auto-rollback fires in ~60s (see §1) |
| Deployment completed but smoke checks failed in CI | Manual rollback via Dokploy API (see §2) |
| Deployment completed, smoke passed, but user impact detected | Manual rollback via Dokploy API (see §2) |
| Database schema migration broke (rollback not safe) | Stop rollback — escalate to DBA (see §4) |
| All Dokploy Applications unavailable | Emergency: re-activate docker-compose.prod.yml (see §5) |

---

## 1. Automatic Rollback (Docker Swarm)

The API and Web Applications are configured with `"FailureAction": "rollback"` in their Swarm `UpdateConfig`.  If a new container fails its health check during a rolling update, Docker Swarm automatically reverts the service to the previous working image **without any manual intervention**.

**Indicators that auto-rollback is underway:**

- Dokploy deployment status shows `"error"` or transitions back to `"done"` after a short failure.
- In Dokploy logs: `"rollback: completed"` or `"update failed, performing rollback"`.
- The `deploy-api` or `deploy-web` CI job fails at the *health gate* step — the old replica was re-instated.

**No action required.** Monitor the Dokploy deployment logs and verify the previous version is serving traffic via:

```bash
curl -fsS https://urlfy.cc/api/health/ready
curl -fsS https://urlfy.cc/ops/health/ready
```

If both return HTTP 200, the auto-rollback succeeded.

---

## 2. Manual Rollback via Dokploy API

Use this procedure when:
- The deployment completed (Swarm accepted the new image) but the application is misbehaving.
- Auto-rollback did not trigger.
- You need to roll back to a *specific* previous release, not just the previous Swarm state.

If Dokploy registry-based rollback is enabled for the Application, you may use the dashboard rollback button as a convenience after confirming the selected deployment matches `release-manifest.json`. The manual API-driven image pinning flow below remains the deterministic fallback and the cross-service source of truth.

### 2.1 Find the target release

1. Go to **GitHub → Releases** for the `urlfy.cc` repository.
2. Identify the last known-good release tag, e.g. `release-20260501120000-abc123def456`.
3. Download the `release-manifest.json` attached to that Release.
4. Note the digest or tag for each service image:
   ```json
   "api": {
     "reference": "ghcr.io/<owner>/urlfy-api:release-20260501120000-abc123def456",
     "digest": "sha256:..."
   }
   ```

### 2.2 Repoint Dokploy to the target release images

Use the immutable image references from `release-manifest.json` directly. No GHCR re-tagging is required.

```bash
DOKPLOY_API_URL="https://your-dokploy-server.example.com"
DOKPLOY_API_KEY="<your-api-key>"

WEB_IMAGE="$(jq -r '.images.web.reference' release-manifest.json)"
API_IMAGE="$(jq -r '.images.api.reference' release-manifest.json)"
WORKER_IMAGE="$(jq -r '.images.worker.reference' release-manifest.json)"

update_application_image() {
  local app_id="$1"
  local image="$2"

  curl -X POST "$DOKPLOY_API_URL/api/application.update" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $DOKPLOY_API_KEY" \
    -d "{\"applicationId\": \"$app_id\", \"dockerImage\": \"$image\"}"
}

deploy_application() {
  local app_id="$1"

  curl -X POST "$DOKPLOY_API_URL/api/application.deploy" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $DOKPLOY_API_KEY" \
    -d "{\"applicationId\": \"$app_id\"}"
}
```

### 2.3 Trigger re-deployment via Dokploy API

Update each Application to the target manifest image and then trigger a deploy. **Follow the same rollback order as forward deployments, reversed for traffic-serving services:**

```
web rollback → api rollback → worker rollback
```

> Never roll back the migrate Application to run schema changes in reverse — see §4.

```bash
# Trigger web rollback first (removes new front-end)
update_application_image "<DOKPLOY_APP_ID_WEB>" "$WEB_IMAGE"
deploy_application "<DOKPLOY_APP_ID_WEB>"

# Wait for web to stabilise, then roll back API
update_application_image "<DOKPLOY_APP_ID_API>" "$API_IMAGE"
deploy_application "<DOKPLOY_APP_ID_API>"

# Finally roll back worker
update_application_image "<DOKPLOY_APP_ID_WORKER>" "$WORKER_IMAGE"
deploy_application "<DOKPLOY_APP_ID_WORKER>"
```

Poll deployment status between each step:

```bash
curl -sf "$DOKPLOY_API_URL/api/deployment.all?applicationId=<APP_ID>&limit=1" \
  -H "x-api-key: $DOKPLOY_API_KEY" | jq '.[0].status'
```

Wait for `"done"` before proceeding to the next service.

### 2.4 Verify rollback

```bash
curl -fsS https://urlfy.cc/api/health/ready
# Expected: HTTP 200 with JSON status "ready" or "degraded"

curl -fsS https://urlfy.cc/ops/health/ready
# Expected: HTTP 200 with JSON status "ready" or "degraded"
```

---

## 3. Using the GitHub Actions Staging Workflow as a Rollback Dry-Run

Before rolling back production, you can verify the target image is healthy on staging:

1. Go to **GitHub → Actions → Deploy (Staging)** → **Run workflow**.
2. Enter the target release tag (e.g. `release-20260501120000-abc123def456`). The workflow repoints the staging Dokploy Applications to that immutable GHCR tag before deploying. Ensure `STAGING_SMOKE_SHORT_CODE` and `STAGING_SMOKE_EXPECTED_LOCATION` are configured, or run with `skip_smoke=true` only when you are intentionally validating a broken state.
3. Confirm staging smoke checks pass.
4. Proceed with the production rollback (§2).

---

## 4. Schema Rollback — Do Not Automate

Database schema migrations (run by `urlfy-migrate`) are **not automatically reversed** by any step in this playbook.

**Why**: Drizzle migrations are append-only.  A rollback migration must be written explicitly and tested before being applied.  Running a previous application version against a newer schema may be safe (additive changes are generally backwards-compatible) but must be verified case-by-case.

**Protocol when a schema migration is involved**:

1. **Do not trigger a migrate deployment in the rollback direction.**
2. Assess whether the running schema is backwards-compatible with the rollback application version.
3. If yes: roll back application images only (§2) — leave the schema as-is.
4. If no: escalate to DBA for an explicit rollback migration.  Do not resume automated deployments until the rollback migration is applied and verified.
5. Document the incident in the repository wiki with the schema state at each point.

---

## 5. Emergency Fallback: Reactivate docker-compose.prod.yml

> Use only when all Dokploy Applications are unavailable or unrecoverable and the situation cannot wait for the standard rollback procedure.

The file `docker/docker-compose.prod.yml` is preserved as the last-resort baseline.  It describes the full service graph as a single Compose stack.

**Steps**:

1. SSH into the Dokploy server.
2. Locate the `docker-compose.prod.yml` file (or pull it from the repository).
3. Ensure the `.env` file or environment variables are populated (copy from the Dokploy Application env settings).
4. Start the stack manually:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
5. Verify health:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl -fsS http://localhost:3001/api/health/ready
   curl -fsS http://localhost:3000/ops/health/ready
   ```
6. Redirect traffic through Traefik (or DNS) to the Compose stack while Dokploy Applications are stabilised.

**After stabilisation**:

1. Restore the Dokploy Applications to a healthy state.
2. Re-provision environment variables in each Application.
3. Use the `release-manifest.json` from the last known-good release and follow §2 to repoint each Dokploy Application to those immutable image references.
4. Decommission the emergency Compose stack.
5. Set `DOKPLOY_DEPLOY_ENABLED = true` only after full verification.

---

## 6. Preventing Future Incidents

| Action | Recommendation |
|--------|----------------|
| Monitor health endpoints | Set up uptime alerts on `/api/health/ready` and `/ops/health/ready` |
| Watch Dokploy deployment logs | Enable notifications for deployment `"error"` status |
| Test rollback before you need it | Run a staging rollback drill quarterly |
| Keep release manifests | 90-day retention in GitHub Actions artifacts; attached to GitHub Releases indefinitely |
| Schema migration review | Require explicit DBA sign-off on all non-additive schema changes before merging to `main` |
| Canary deployments | For high-risk releases, consider deploying API to 1 replica first, verifying, then scaling |
