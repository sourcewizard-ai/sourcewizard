import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGitHubAppJWT } from '../../../lib/github-app';

function getSecretKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function POST(req: NextRequest) {
  try {
    const { installation_id } = await req.json();

    if (!installation_id) {
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

    // Get GitHub App credentials
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_PRIVATE_KEY;

    if (!appId || !privateKey) {
      return new Response(
        JSON.stringify({ error: 'GitHub App not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate JWT
    const jwt = generateGitHubAppJWT(appId, privateKey.replace(/\\n/g, '\n'));

    // Fetch installation details
    const installationResponse = await fetch(
      `https://api.github.com/app/installations/${installation_id}`,
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SourceWizard-Planner'
        }
      }
    );

    if (!installationResponse.ok) {
      const errorText = await installationResponse.text();
      console.error('GitHub API error:', installationResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch installation from GitHub' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const installation = await installationResponse.json();

    // Save installation to database
    const { data, error } = await supabase
      .from('github_installations')
      .upsert({
        user_id: user.id,
        github_id: parseInt(installation_id),
        name: installation.account.login,
        url: `https://github.com/${installation.account.login}`,
        branch: 'main',
      }, {
        onConflict: 'user_id,github_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving installation:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save installation' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json({
      success: true,
      installation: data,
    });

  } catch (error) {
    console.error('Error in github-installation API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
