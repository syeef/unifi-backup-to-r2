# unifi-backup-to-r2

## Intro

Use the UniFi API to login to your controller, generate a backup file, and upload it to a Cloudflare R2 bucket.

## Setup

### .dev.vars

Create a new file called `.dev.vars` containing the following values:

```
USERNAME="replace-with-username"
PASSWORD="replace-with-password"
```

Use `npx wrangler secret put <KEY>` to add it to Cloudflare Workers.

### wrangler.toml

Within the `wrangler.toml` file, ensure the following are all supplied:

```
workers_dev = false
```

- Disables access from the default provided `workers.dev` domain

```
[triggers]
crons = ["0 1 * * sun"]
```

- Creates a Cron trigger to execute every Sunday at 01:00 UTC

```
[vars]
BASE_URL = "https://example.com"
USER_AGENT = "<YOUR_CUSTOM_USER_AGENT>"
```

- Defines the BASE_URL variable used throughout the script
- Defines the USER_AGENT variable used throughout the script; this is to the allow the use of Cloudflare Custom Firewall Rules
  - Example of Cloudflare Custom Firewall Rule, ensure the user-agent is equal to what is specified here; the HTTP Version (`http.request.version`) and AS Num (`ip.geoip.asnum`) were obtained by observing logged events from Firewall Events
  - `(http.user_agent eq "<YOUR_CUSTOM_USER_AGENT>" and http.request.version eq "HTTP/1.1" and ip.geoip.asnum in {132892 13335})`

```
[[r2_buckets]]
binding = 'MY_BUCKET' # <~ valid JavaScript variable name
bucket_name = '<YOUR_BUCKET_NAME>'
preview_bucket_name = "preview-YOUR_BUCKET_NAME"
```

- Defines the various R2 buckets used throughout the script
