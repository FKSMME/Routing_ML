# Internal Network Deployment Playbook

This playbook documents how the Routing ML platform is prepared for deployment inside restricted or fully disconnected environments. It focuses on three operational pillars: container registry mirroring, air-gapped image promotion, and secret distribution.

## Registry Mirroring Strategy

1. **Source registry selection**
   - Mirror both trainer and predictor images that originate from the public build pipeline (`routing-ml-trainer:latest` and `routing-ml-predictor:latest`).
   - Include any upstream base images referenced by the Dockerfiles to avoid external pulls during runtime.
2. **Mirror execution**
   - Use `skopeo copy` or the `docker pull`/`docker tag`/`docker push` sequence to replicate images into the internal registry (e.g., `registry.infra.lan/routing-ml/*`).
   - Schedule nightly sync jobs via CI to refresh mirrored tags while the network is available.
3. **Policy controls**
   - Enforce signed images via Notary or Cosign prior to mirroring.
   - Require vulnerability scans before internal publication and gate promotion on scan compliance.

## Air-Gap Image Promotion Workflow

1. **Export bundle creation**
   - Use `docker save` to produce tar archives of the trainer and predictor images plus any helper images required for migrations.
   - Store archives alongside an SBOM and checksum manifest for integrity verification.
2. **Offline transfer**
   - Move the bundle to the air-gapped site via approved removable media following security policy.
   - On arrival, validate checksums and signature attestations before import.
3. **Import and tag**
   - Run `docker load` on the target registry host and retag images for the internal registry namespace.
   - Push images into the isolated registry and update deployment manifests to reference the internal tags.

## Secrets Handling

1. **Secret storage**
   - Maintain runtime credentials (database strings, API keys) within an offline-capable secret manager (e.g., HashiCorp Vault with sealed backups) or encrypted configuration store.
   - Rotate secrets according to corporate policy prior to each deployment wave.
2. **Distribution**
   - Provide deployment teams with sealed secret bundles (age/PGP encrypted) that can be decoded only inside the secure environment.
   - Avoid embedding secrets in compose files; consume them at runtime via environment injection or Docker secrets.
3. **Audit and access**
   - Log all secret retrievals and updates for traceability.
   - Require multi-party approval for any secret regeneration in the air-gapped zone.

## Compose Overrides and Offline Volume Caching

The baseline compose configuration (`deploy/docker/docker-compose.yml`) binds local directories for data, models, and config. To operate fully offline:

1. **Prepare cache volumes**
   - Pre-populate the `./volumes/data`, `./volumes/models`, and `./volumes/config` directories with the datasets, trained artifacts, and configuration files exported from the connected environment.
2. **Create an override file**
   - Author `docker-compose.override.yml` (or an environment-specific override) that switches bind mounts to named volumes synchronized from offline storage snapshots. Example snippet:

     ```yaml
     services:
       trainer:
         volumes:
           - type: volume
             source: routing-ml-data-cache
             target: /mnt/data
     volumes:
       routing-ml-data-cache:
         external: true
     ```

3. **Synchronize caches**
   - Prior to deployment, load the offline snapshots into the external Docker volumes using `docker volume create` plus `docker run --rm -v volume:/target -v /media/cache:/source busybox sh -c "cp -r /source/* /target/"`.
4. **Deployment verification**
   - Run `docker compose --profile offline up -d` (if profiles are defined) or specify the override file with `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d` to ensure cached data is used without internet access.

## Review and Sign-Off

- **DevOps Owner:** Confirmed the procedures above and approved the playbook for internal distribution.
- **Date:** 2025-10-05

