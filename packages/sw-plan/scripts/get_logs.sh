#!/bin/bash
. .env

SESSION_ID="$1"
curl -H"x-api-key: $SOURCEWIZARD_API_KEY" -XGET "http://localhost:3001/api/plan/logs?sessionId=$SESSION_ID"
