#!/bin/bash
. .env

REQ=$(
  cat <<EOF
{
  "transcript": $(cat ./transcript.txt | jq -Rsa),
  "name": "brd-test",
  "docType": "brd",
  "useSandbox": false
}
EOF
)

curl -H"x-api-key: $SOURCEWIZARD_API_KEY" -XPUT --json "$REQ" 'http://localhost:3001/api/plan'
