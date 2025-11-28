import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const language = searchParams.get('language');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const autocomplete = searchParams.get('autocomplete') === 'true';

    if (!query || query.trim().length === 0) {
      // For autocomplete, return empty results instead of error
      if (autocomplete) {
        return new Response(
          JSON.stringify({ packages: [], total: 0 }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
            }
          }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // For autocomplete, use fast substring matching with relevance scoring
    if (autocomplete) {
      const searchPattern = `%${query}%`;
      let dbQuery = supabase
        .from('packages')
        .select('id, name, description, language, tags')
        .eq('staging', false)
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit * 2); // Fetch more for client-side scoring

      if (language && language.trim().length > 0) {
        dbQuery = dbQuery.eq('language', language);
      }

      const { data, error } = await dbQuery;

      if (error) {
        console.error('Search packages error:', error);
        return new Response(
          JSON.stringify({ packages: [], total: 0 }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
            }
          }
        );
      }

      // Score and sort results by relevance
      const queryLower = query.toLowerCase();
      const scoredResults = (data || []).map(pkg => {
        let score = 0;

        // Exact name match
        if (pkg.name.toLowerCase() === queryLower) {
          score += 100;
        }
        // Name starts with query
        else if (pkg.name.toLowerCase().startsWith(queryLower)) {
          score += 50;
        }
        // Name contains query
        else if (pkg.name.toLowerCase().includes(queryLower)) {
          score += 20;
        }

        // Description contains query
        if (pkg.description.toLowerCase().includes(queryLower)) {
          score += 10;
        }

        // Tags contain query
        if (pkg.tags && Array.isArray(pkg.tags)) {
          const matchingTags = pkg.tags.filter(tag =>
            tag.toLowerCase().includes(queryLower)
          );
          if (matchingTags.length > 0) {
            score += 15 * matchingTags.length;
          }
        }

        return { pkg, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.pkg);

      return new Response(
        JSON.stringify({
          packages: scoredResults,
          total: scoredResults.length
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          }
        }
      );
    }

    // For full search, use PostgreSQL full-text search with pagination
    let dbQuery = supabase
      .from('packages')
      .select('id, name, description, tags, language, metadata, created_at, updated_at', { count: 'exact' })
      .eq('staging', false)
      .textSearch('name_description', query, {
        type: 'websearch',
        config: 'english'
      })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (language && language.trim().length > 0) {
      dbQuery = dbQuery.eq('language', language);
    }

    const { data, error, count } = await dbQuery;

    if (error) {
      console.error('Search packages error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to search packages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        packages: data || [],
        total: count || 0,
        limit,
        offset
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search packages error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to search packages' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
