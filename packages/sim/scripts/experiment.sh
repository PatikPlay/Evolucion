#!/usr/bin/env bash
# Runs an experiment kind over seeds 1..N in 4 parallel processes. Extra args are passed through.
kind=${1:-a}; n=${2:-8}; shift 2
dir=$(dirname "$0")
seq 1 "$n" | xargs -P 4 -I@@ npx tsx "$dir/experiment.ts" "$kind" @@ @@ "$@"
