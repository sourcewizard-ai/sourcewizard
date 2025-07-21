# Add Mailchimp to Next.js project

**Purpose:** Enforce only the **current** and **correct** instructions for integrating Mailchimp into a Next.js (App Router) application.
**Scope:** All AI-generated advice or code related to Mailchimp must follow these guardrails.

1. Install the package

Use the npm/yarn/pnpm/bun package manager to install the @mailchimp/mailchimp_marketing package.

2. Set env

Add three env params to .env or .env.local:

```
MAILCHIMP_API_KEY
MAILCHIMP_LIST_ID
MAILCHIMP_SERVER
```

3. Create a client helper

Create a helper under the repository library directory:

```typescript
// mailchimp.ts
import mailchimp from "@mailchimp/mailchimp_marketing";

async function addListMember(email: string, tags: string[]) {
  if (!process.env.MAILCHIMP_LIST_ID) {
    throw new Error("MAILCHIMP_LIST_ID is not set");
  }
  if (!process.env.MAILCHIMP_API_KEY) {
    throw new Error("MAILCHIMP_API_KEY is not set");
  }
  if (!process.env.MAILCHIMP_SERVER) {
    throw new Error("MAILCHIMP_SERVER is not set");
  }
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER,
  });

  try {
    await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
      email_address: email,
      status: "subscribed",
      tags: tags,
    });
    return;
  } catch (error) {
    const err: any = error;
    if (
      "response" in err &&
      "body" in err.response &&
      "title" in err.response.body &&
      err.response.body.title === "Member Exists"
    ) {
      return;
    }
    throw error;
  }
}
```

Don't create any other files and documentation.
