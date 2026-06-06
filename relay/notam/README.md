# forecast NOTAM SWIM relay

Long-running Node process that consumes FAA SWIM FNS NOTAM messages from a Solace JMS queue, parses the AIXM 5.1 payload into a canonical NOTAM record, geo-filters to the configured radius, and forwards batches to the Forecast Cloudflare Worker.

Workers cannot open arbitrary outbound TCP on port 55443, so this relay must run somewhere with persistent network — a home box or any small Linux VM is the intended target.

## Build

```bash
cd relay/notam
npm ci
npm run build
```

## Deploy (home box, systemd)

```bash
# Create the runtime user and target directory
sudo useradd -r -s /usr/sbin/nologin forecast-relay
sudo mkdir -p /opt/forecast-relay/notam
sudo chown -R forecast-relay:forecast-relay /opt/forecast-relay

# Copy the built relay
sudo -u forecast-relay rsync -a dist/ /opt/forecast-relay/notam/dist/
sudo -u forecast-relay rsync -a node_modules/ /opt/forecast-relay/notam/node_modules/
sudo cp package.json /opt/forecast-relay/notam/

# Stage the env file (mode 600, owned by the runtime user)
sudo install -o forecast-relay -g forecast-relay -m 600 \
  .env.example /opt/forecast-relay/.env
sudo -u forecast-relay $EDITOR /opt/forecast-relay/.env

# Install the service unit
sudo cp systemd/forecast-notam-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now forecast-notam-relay

# Watch logs
journalctl -u forecast-notam-relay -f
```

## Environment

See `.env.example`. The SWIM password and `INGEST_TOKEN` are secrets — keep them out of the repo and out of any chat transcripts.

`INGEST_TOKEN` must match the value set on the Worker:

```bash
npx wrangler secret put INGEST_TOKEN
```

## Operation

- Log lines are single-line JSON; `journalctl` will show them cleanly. The relay prints a `stats` line every 60s with running totals.
- A flush is triggered when the in-memory buffer reaches `BATCH_MAX_RECORDS` (default 50) or `BATCH_MAX_AGE_MS` (default 30s) has elapsed since the first record landed in the current batch.
- The SWIM client reconnects automatically on transient failures.

## Geo filter

Off by default in `.env.example` only conceptually — the default in code is **on**, dropping NOTAMs outside the configured radius before forwarding. Set `GEO_FILTER=0` to forward the national firehose; expect a substantial bump in D1 write volume.

## Connectivity smoke test

Before the systemd unit is even built, confirm the host can reach the SWIM broker:

```bash
openssl s_client -connect ems1.swim.faa.gov:55443 -servername ems1.swim.faa.gov -showcerts </dev/null 2>&1 | head -30
```

A successful TLS handshake and FAA cert chain should print.
