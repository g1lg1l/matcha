#!/usr/bin/env bash
# Tests matcha.sql on a local Postgres (needs a running server and `psql` as the postgres user).
# Applies the schema twice (it must be re-runnable), then runs rls.sql. Read the "expect" lines.
set -euo pipefail
dir=$(mktemp -d)
cp "$(dirname "$0")"/stub.sql "$(dirname "$0")"/rls.sql "$(dirname "$0")"/../matcha.sql "$dir"/
chmod -R a+rX "$dir"
psql_() { su postgres -c "psql -q -X $*"; }
psql_ "-f $dir/stub.sql" >/dev/null 2>&1
if [ -n "${PREVIOUS:-}" ]; then cp "$PREVIOUS" "$dir/prev.sql"; chmod a+r "$dir/prev.sql"; psql_ "-d matcha_test -v ON_ERROR_STOP=1 -f $dir/prev.sql" >/dev/null 2>&1; echo "applied previous version"; fi
psql_ "-d matcha_test -v ON_ERROR_STOP=1 -f $dir/matcha.sql" >/dev/null 2>&1 && echo "applied"
psql_ "-d matcha_test -v ON_ERROR_STOP=1 -f $dir/matcha.sql" >/dev/null 2>&1 && echo "re-applied"
psql_ "-d matcha_test -t -A -F ' | ' -f $dir/rls.sql" 2>&1 | sed -E 's#^psql:[^ ]+ ##'
