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
    const repo = searchParams.get('repo');

    if (!installationId || !repo) {
      return new Response(
        JSON.stringify({ error: 'Missing installation_id or repo' }),
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
        JSON.stringify({ error: 'Failed to get installation token' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch branches with pagination
    let allBranches: string[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Limit to 10 pages (1000 branches max)
      const branchesResponse = await fetch(
        `https://api.github.com/repos/${repo}/branches?per_page=100&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SourceWizard-Planner'
          }
        }
      );

      if (!branchesResponse.ok) {
        const errorText = await branchesResponse.text();
        console.error('GitHub branches error:', branchesResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch branches' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const branchesData = await branchesResponse.json();
      const branches = branchesData.map((branch: any) => branch.name);
      allBranches = allBranches.concat(branches);

      // Check if there are more pages
      hasMore = branchesData.length === 100;
      page++;
    }

    return NextResponse.json({
      success: true,
      branches: allBranches,
    });

  } catch (error) {
    console.error('Error in github-branches API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
