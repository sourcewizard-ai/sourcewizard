# Install React Blog Module


### Step 1: Install the Package

```bash
npm install react-blog-module
# or
yarn add react-blog-module
# or
pnpm add react-blog-module
```

### Step 2: Install Peer Dependencies

```bash
npm install react react-dom @supabase/supabase-js
```

### Step 3: Set Up Supabase (Optional)

If you want to use Supabase as a content source, create a table in your Supabase database:

```sql
CREATE TABLE blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  draft BOOLEAN DEFAULT false,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies as needed
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Example: Allow public read access to published posts
CREATE POLICY "Public can read published posts" ON blog_posts
  FOR SELECT USING (draft = false);
```

### Step 4: Configure Your Blog

Create a blog configuration:

```typescript
import { createBlogConfig, BlogAuthorInfo } from 'react-blog-module';
import { createClient } from '@supabase/supabase-js';

// Set up Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define authors
const authors: BlogAuthorInfo[] = [
  {
    name: 'John Doe',
    avatar: '/avatars/john.jpg',
    bio: 'Software engineer and technical writer',
    social: {
      twitter: 'johndoe',
      github: 'johndoe',
      linkedin: 'johndoe'
    }
  }
];

// Create blog configuration
export const blogConfig = createBlogConfig(
  'My Blog',                    // title
  'A blog about tech and code', // description
  authors,                      // authors array
  supabase,                     // Supabase client
  '/blog',                      // basePath (optional)
  'content/blog'                // contentPath (optional)
);
```

### Step 5: Create Content Directory (For File-Based Posts)

Create a content directory for your MDX files:

```
content/blog/
├── my-first-post.mdx
├── another-post.mdx
└── ...
```

Example MDX file (`content/blog/my-first-post.mdx`):

```mdx
---
title: "My First Blog Post"
date: "2024-01-15"
description: "This is my first blog post using the React Blog Module"
author: "John Doe"
draft: false
---

# Welcome to My Blog

This is the content of my first blog post. I can use **markdown** and even React components!

## Code Example

```javascript
function hello() {
  console.log('Hello, world!');
}
```

## Step 6: Create blog pages

This is an example of pages for Next.js with app router;

### Blog Posts List Page

```typescript
// app/blog/page.tsx

import { BlogPostsPage, getMetadata } from 'react-blog-module';
import { blogConfig } from './blog-config';

export default function BlogPage() {
  return <div>
    <!-- Existing website layout -->
    <BlogPostsPage config={blogConfig} />
    </div>;
}

// For Next.js metadata
export async function generateMetadata() {
  return await getMetadata(blogConfig);
}
```

### Single Blog Post Page

```typescript
// app/blog/[slug]/page.tsx

import { SingleBlogPost, generateBlogMetadata, generateNextStaticParams } from 'react-blog-module';
import { blogConfig } from '../blog-config';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function BlogPost({ params }: Props) {
  return <div>
    <!-- Existing website layout -->
    <SingleBlogPost params={params} config={blogConfig} />
    </div>;
}

// For Next.js
export async function generateMetadata({ params }: Props) {
  return await generateBlogMetadata({ params, config: blogConfig });
}

export async function generateStaticParams() {
  return await generateNextStaticParams(blogConfig);
}
```

