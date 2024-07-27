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

Within the `wrangler.tomml` file, ensure the following are all supplied:

```
[triggers]
crons = ["0 10 * * wed","0 1 * * sat"]
```

```
[vars]
BASE_URL = "https://example.com"
```

```
[[r2_buckets]]
binding = 'MY_BUCKET' # <~ valid JavaScript variable name
bucket_name = '<YOUR_BUCKET_NAME>'
preview_bucket_name = "preview-YOUR_BUCKET_NAME"
```
