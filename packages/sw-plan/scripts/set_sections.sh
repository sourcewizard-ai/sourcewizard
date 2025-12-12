#!/bin/bash
. .env

SESSION_ID="$1"
REQ=$(
  cat <<EOF
{
  "sessionId": "$SESSION_ID",
  "sections": $(cat ./sections.json)
}
EOF
)

curl -H"x-api-key: $SOURCEWIZARD_API_KEY" -XPUT --json "$REQ" 'http://localhost:3001/api/plan'
