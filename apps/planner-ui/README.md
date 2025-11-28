# SourceWizard Integration Planner

[![Website](https://img.shields.io/badge/Website-sourcewizard.ai-blue)](https://sourcewizard.ai/planner)

[![View the video](https://github.com/user-attachments/assets/56d6f95a-6acb-4bae-bda8-0d7ed6c3e6a3)](
https://video.twimg.com/amplify_video/1994501156153036803/vid/avc1/1590x1080/E0aGdYtt1QRoz7tR.mp4?tag=21)

## Overview

SourceWizard Planner is an web UI for generating integration plans for external SDKs and libraries based to your repository configuration.
The UI will guide you through the trade-offs and decisions that occur during any library integration.

## Usage

You can use our web version to try it out: https://sourcewizard.ai/planner

### Self-hosting

This app is Next.js based, so running it locally is pretty straghtforward:

```bash
bun run dev
```

The coding agent is based on Claude Agents SDK and it can be run either locally or via Vercel Sandbox.
Once you start the server you can toggle that in the settings.

NOTE: You need to provide environment variables for Anthropic, Github app, Context7 and Supabase.
Here's the list:
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_JWT_SECRET
- SUPABASE_SERVICE_ROLE_KEY
- VERCEL_OIDC_TOKEN (if you use sandbox)
- NEXT_PUBLIC_GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- GITHUB_APP_ID
- GITHUB_PRIVATE_KEY
- CONTEXT7_API_KEY

## License

Apache-2.0 - see [LICENSE](../LICENSE) for details.
