import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGitHubAppJWT } from '../../../lib/github-app';

export const runtime = 'nodejs';

function getSecretKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function GET(req: NextRequest) {
  try {
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

    // Fetch user's GitHub installations from database
    const { data: installations, error: installError } = await supabase
      .from('github_installations')
      .select('*')
      .order('created_at', { ascending: false});

    if (installError) {
      console.error('Error fetching installations:', installError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch installations' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get GitHub App credentials
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_PRIVATE_KEY;

    if (!appId || !privateKey) {
      // Can't validate without credentials, just return what we have
      return NextResponse.json({
        success: true,
        installations: installations || [],
      });
    }

    // Generate JWT
    const jwt = generateGitHubAppJWT(appId, privateKey.replace(/\\n/g, '\n'));

    // Validate each installation and mark invalid ones
    const validatedInstallations = [];
    let hasInvalidInstallations = false;

    for (const installation of installations || []) {
      try {
        // Check if installation still exists in GitHub
        const installationResponse = await fetch(
          `https://api.github.com/app/installations/${installation.github_id}`,
          {
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'SourceWizard-Planner'
            }
          }
        );

        if (installationResponse.ok) {
          // Installation is valid
          validatedInstallations.push(installation);
        } else if (installationResponse.status === 404) {
          // Installation was removed - mark URL as null to indicate invalid
          hasInvalidInstallations = true;
          console.log(`Installation ${installation.github_id} not found in GitHub, marking as invalid`);

          // Update the database to mark as invalid (set url to null)
          await supabase
            .from('github_installations')
            .update({ url: null })
            .eq('id', installation.id);
        } else {
          // Some other error, include it but log the error
          console.warn(`Could not validate installation ${installation.github_id}:`, installationResponse.status);
          validatedInstallations.push(installation);
        }
      } catch (error) {
        console.error(`Error validating installation ${installation.github_id}:`, error);
        // On error, include the installation
        validatedInstallations.push(installation);
      }
    }

    return NextResponse.json({
      success: true,
      installations: validatedInstallations,
      hasInvalidInstallations,
    });

  } catch (error) {
    console.error('Error in github-repositories API:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
