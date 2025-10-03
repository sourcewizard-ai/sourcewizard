# Send emails with Next.js

> Learn how to send your first email using Next.js and the Resend Node.js SDK.

## Prerequisites

To get the most out of this guide, you'll need to:

* [Create an API key](https://resend.com/api-keys)
* [Verify your domain](https://resend.com/domains)

Prefer watching a video? Check out our video walkthrough below.

<div className="aspect-video">
  <iframe width="100%" height="100%" src="https://www.youtube.com/embed/UqQxfpTQBaE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen />
</div>

## 1. Install

Get the Resend Node.js SDK.

<CodeGroup>
  ```bash npm
  npm install resend
  ```

  ```bash yarn
  yarn add resend
  ```

  ```bash pnpm
  pnpm add resend
  ```
</CodeGroup>

## 2. Create an email template

Start by creating your email template on `components/email-template.tsx`.

```tsx components/email-template.tsx
import * as React from 'react';

interface EmailTemplateProps {
  firstName: string;
}

export function EmailTemplate({ firstName }: EmailTemplateProps) {
  return (
    <div>
      <h1>Welcome, {firstName}!</h1>
    </div>
  );
}
```

## 3. Install email rendering library

<CodeGroup>
  ```bash npm
  npm install @react-email/render
  ```

  ```bash yarn
  yarn add @react-email/render
  ```

  ```bash pnpm
  pnpm add @react-email/render
  ```
</CodeGroup>

## 4. Send email using React

Create an API file under `pages/api/send.ts` if you're using the [Pages Router](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) or create a route file under `app/api/send/route.ts` if you're using the [App Router](https://nextjs.org/docs/app/building-your-application/routing/router-handlers).

Import the React email template and send an email using the `react` parameter.

<CodeGroup>
  ```ts pages/api/send.ts
  import type { NextApiRequest, NextApiResponse } from 'next';
  import { EmailTemplate } from '../../components/EmailTemplate';
  import { Resend } from 'resend';

  const resend = new Resend(process.env.RESEND_API_KEY);

  export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'Hello world',
      react: EmailTemplate({ firstName: 'John' }),
    });

    if (error) {
      return res.status(400).json(error);
    }

    res.status(200).json(data);
  };
  ```

  ```ts app/api/send/route.ts
  import { EmailTemplate } from '../../../components/EmailTemplate';
  import { Resend } from 'resend';

  const resend = new Resend(process.env.RESEND_API_KEY);

  export async function POST() {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: ['delivered@resend.dev'],
        subject: 'Hello world',
        react: EmailTemplate({ firstName: 'John' }),
      });

      if (error) {
        return Response.json({ error }, { status: 500 });
      }

      return Response.json(data);
    } catch (error) {
      return Response.json({ error }, { status: 500 });
    }
  }
  ```
</CodeGroup>

## 5. Try it yourself

<CardGroup>
  <Card title="Next.js Example (Pages Router)" icon="arrow-up-right-from-square" href="https://github.com/resend/resend-nextjs-pages-router-example">
    See the full source code.
  </Card>

  <Card title="Next.js Example (App Router)" icon="arrow-up-right-from-square" href="https://github.com/resend/resend-nextjs-app-router-example">
    See the full source code.
  </Card>
</CardGroup>

