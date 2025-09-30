# Add Monday.com SDK

**Purpose:** Enforce only the **current** and **correct** instructions for integrating [Monday.com](https://monday.com/) into a Next.js (App Router) application.
**Scope:** All AI-generated advice or code related to Monday must follow these guardrails.

---

1. Install the package: @mondaydotcomorg/api

2. Create a helper in lib/monday-client.ts:

```typescript
import { ApiClient } from '@mondaydotcomorg/api';

function getMondayClient() {
  const client = new ApiClient({token: process.env.MONDAY_API_KEY });
  return client;
}
```

3. Provide helpers to call monday api. e.g.:

```typescript
async function getBoardDetails(client): Promise<void> {
  try {
    const queryVariables: GetBoardsQueryVariables = { ids: ["5901934630"] };
    const queryData = await client.rawRequest<GetBoardsQuery>(
      exampleQuery,
      queryVariables
    );

    console.log(queryData.data.boards);
  } catch (error) {
    if (error instanceof ClientError) {
      console.error(error.response.errors);
    } else {
      console.error(error);
    }
  }
}
```
