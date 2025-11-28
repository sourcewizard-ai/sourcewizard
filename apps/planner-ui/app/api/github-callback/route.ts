import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSecretKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function POST(req: NextRequest) {
  try {
    const { installation_id, repositories } = await req.json();

    if (!installation_id || !repositories || !Array.isArray(repositories)) {
      return new Response(
        JSON.stringify({ error: 'Missing installation_id or repositories' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get access token from header
    const accessToken = getSecretKeyFromHeader(req);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Save repositories to database
    const savedRepositories = [];
    for (const repo of repositories) {
      const { data, error } = await supabase
        .from('github_repositories')
        .upsert({
          user_id: user.id,
          github_id: repo.id,
          name: repo.full_name,
          url: repo.html_url,
          branch: repo.default_branch || 'main',
        }, {
          onConflict: 'user_id,github_id',
        })
        .select()
        .single();

      if (!error && data) {
        savedRepositories.push(data);
      } else {
        console.error('Error saving repository:', error);
      }
    }

    return NextResponse.json({
      success: true,
      repositories: savedRepositories,
    });

  } catch (error) {
    console.error('Error in github-callback API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
