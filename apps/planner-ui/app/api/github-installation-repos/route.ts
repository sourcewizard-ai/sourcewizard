import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getInstallationAccessToken } from '../../../lib/github-app';

function getSecretKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const installationId = searchParams.get('installation_id');

    if (!installationId) {
      return new Response(
        JSON.stringify({ error: 'Missing installation_id' }),
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

    // Get installation access token
    const token = await getInstallationAccessToken(installationId);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Installation not found - it may have been removed from GitHub' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch repositories with pagination
    let allRepositories: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Limit to 10 pages (1000 repos max)
      const reposResponse = await fetch(
        `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SourceWizard-Planner'
          }
        }
      );

      if (!reposResponse.ok) {
        const errorText = await reposResponse.text();
        console.error('GitHub repos error:', reposResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch repositories' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const reposData = await reposResponse.json();
      const repositories = reposData.repositories || [];
      allRepositories = allRepositories.concat(repositories);

      // Check if there are more pages
      hasMore = repositories.length === 100;
      page++;
    }

    return NextResponse.json({
      success: true,
      repositories: allRepositories,
    });

  } catch (error) {
    console.error('Error in github-installation-repos API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
