import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('id');

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing session ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch session data
    const { data, error } = await supabase
      .from('sandbox_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Don't block expired sessions - still return the data (plans are saved)
    // Just mark it as expired in the response
    const isExpired = new Date(data.expires_at) < new Date();

    return new Response(
      JSON.stringify({
        id: data.id,
        sandboxId: data.sandbox_id,
        sdkSessionId: data.sdk_session_id,
        integration: data.integration,
        repoUrl: data.repo_url,
        repo_url: data.repo_url, // Add snake_case version for compatibility
        repository_url: data.repository_url,
        branch: data.branch,
        installation_id: data.installation_id,
        conversationHistory: data.conversation_history,
        currentStage: data.current_stage,
        status: data.status,
        expiresAt: data.expires_at,
        isExpired: isExpired,
        isLocal: data.sandbox_id.startsWith('local-')
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session fetch error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
