#!/usr/bin/env bash
# Constitution VII: check the deployment before starting work.
#
# Reports whether the production site is up and whether it is serving the
# prerendered markup (a 200 that returns an empty shell is still a broken site).
#
#   npm run status:site
#   SITE_URL=https://example.org npm run status:site

set -uo pipefail

url="${SITE_URL:-https://ana-izaguirre.github.io/prot-spam-sim/}"

read -r code total < <(
  curl -sS -o /tmp/protspam-status.html -w '%{http_code} %{time_total}' --max-time 30 "$url" \
    || echo "000 0"
)

printf '%s\n' "$url"
printf '  HTTP %s in %ss\n' "$code" "$total"

if [ "$code" != "200" ]; then
  printf '  DOWN — the site did not answer with 200\n'
  exit 1
fi

if grep -q 'ProtSpam HPC Suite' /tmp/protspam-status.html; then
  printf '  UP — serving prerendered markup (%s bytes)\n' "$(stat -c%s /tmp/protspam-status.html)"
else
  printf '  DEGRADED — answered 200 but served no prerendered markup\n'
  exit 1
fi
