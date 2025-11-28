import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ICLIRunner, createCLIRunner } from '../../../lib/cli-runner';
import { createVercelSandboxCLIRunner } from '../../../lib/vercel-sandbox-cli-runner';
import { getInstallationAccessToken } from '../../../lib/github-app';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

function getSecretKeyFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Helper function to update conversation_history while preserving existing data
 * @param supabase - Supabase client
 * @param sessionId - Session ID to update
 * @param updates - Partial updates to conversation_history (plans, clarifications, questions, etc.)
 * @param additionalUpdates - Additional fields to update on the session (e.g., status)
 */
async function updateConversationHistory(
  supabase: any,
  sessionId: string,
  updates: {
    plans?: any[];
    clarifications?: any;
    questions?: any;
  },
  additionalUpdates?: { status?: string }
) {
  // Get existing conversation history
  const { data: currentSession } = await supabase
    .from('sandbox_sessions')
    .select('conversation_history')
    .eq('id', sessionId)
    .single();

  const existingHistory = currentSession?.conversation_history || {};
  const mergedHistory: any = { ...existingHistory };

  // Merge plans if provided
  if (updates.plans !== undefined) {
    if (existingHistory.plans && Array.isArray(existingHistory.plans)) {
      // Merge with existing plans by ID
      let allPlans = existingHistory.plans.map((p: any) => {
        const newPlan = updates.plans!.find((np: any) => np.id === p.id);
        return newPlan || p;
      });
      // Add any new plans that weren't in existing
      updates.plans.forEach((np: any) => {
        if (!allPlans.find((p: any) => p.id === np.id)) {
          allPlans.push(np);
        }
      });
      mergedHistory.plans = allPlans;
    } else {
      mergedHistory.plans = updates.plans;
    }
  }

  // Merge clarifications if provided
  if (updates.clarifications !== undefined && updates.clarifications !== null && updates.clarifications !== '') {
    const existingClarifications = existingHistory.clarifications;
    if (typeof updates.clarifications === 'object' && typeof existingClarifications === 'object') {
      mergedHistory.clarifications = { ...existingClarifications, ...updates.clarifications };
    } else {
      mergedHistory.clarifications = updates.clarifications;
    }
  } else if (existingHistory.clarifications) {
    // Preserve existing clarifications if no new ones provided
    mergedHistory.clarifications = existingHistory.clarifications;
  }

  // Set questions if provided (no merging, just set)
  if (updates.questions !== undefined) {
    mergedHistory.questions = updates.questions;
  }

  // Build the update object
  const updateObject: any = {
    conversation_history: mergedHistory
  };

  // Add additional updates if provided
  if (additionalUpdates) {
    Object.assign(updateObject, additionalUpdates);
  }

  // Update the session
  await supabase
    .from('sandbox_sessions')
    .update(updateObject)
    .eq('id', sessionId);
}

/**
 * Helper function to check if user has sufficient credits
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Object with hasCredits boolean and credits info, or Error
 */
async function checkUserCredits(
  supabase: any,
  userId: string
): Promise<{ hasCredits: boolean; remaining: number; total: number; used: number; role: string | null } | Error> {
  try {
    const { data: usage, error } = await supabase
      .from('sw_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[Credit Check Error]', error);
      return new Error('Failed to check credits');
    }

    if (!usage) {
      // No usage record exists - create one with default credits
      const { data: newUsage, error: insertError } = await supabase
        .from('sw_usage')
        .insert({
          user_id: userId,
          total_credits: 100,
          used_credits: 0,
          last_used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Credit Creation Error]', insertError);
        return new Error('Failed to initialize credits');
      }

      return {
        hasCredits: true,
        remaining: 100,
        total: 100,
        used: 0,
        role: null
      };
    }

    const remaining = usage.total_credits - usage.used_credits;
    const hasCredits = remaining > 0;

    console.log('[Credit Check]', {
      user_id: userId,
      total: usage.total_credits,
      used: usage.used_credits,
      remaining,
      hasCredits
    });

    return {
      hasCredits,
      remaining,
      total: usage.total_credits,
      used: usage.used_credits,
      role: usage.role || null
    };
  } catch (error) {
    console.error('[Credit Check Exception]', error);
    return new Error('Failed to check credits');
  }
}

/**
 * Helper function to deduct credits from user's account
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param credits - Number of credits to deduct
 * @param action - Description of action for logging
 */
async function deductCredits(
  supabase: any,
  userId: string,
  credits: number,
  action: string
) {
  try {
    console.log('[Credit Deduction]', {
      user_id: userId,
      credits,
      action
    });

    // Update sw_usage table
    const { data: existingUsage } = await supabase
      .from('sw_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingUsage) {
      // Update existing usage record, but cap at total_credits to prevent negative remaining
      const newUsedCredits = Math.min(
        existingUsage.used_credits + credits,
        existingUsage.total_credits
      );

      await supabase
        .from('sw_usage')
        .update({
          used_credits: newUsedCredits,
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      // Create new usage record if it doesn't exist, cap at total_credits
      const totalCredits = 100; // Default starting credits
      await supabase
        .from('sw_usage')
        .insert({
          user_id: userId,
          total_credits: totalCredits,
          used_credits: Math.min(credits, totalCredits),
          last_used_at: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('[Credit Deduction Error]', error);
    // Don't throw - usage tracking failures shouldn't break the main flow
  }
}

export async function POST(req: NextRequest) {
  try {
    const { integration, projectPath, clarifications, sessionId, repositoryUrl, branch, useSandbox: requestedSandbox, installationId, planId } = await req.json();

    // Force sandbox mode in production
    const useSandbox = process.env.NODE_ENV === 'production' ? true : requestedSandbox;

    console.log('[API] Request params:', {
      integration: integration ? 'present' : 'missing',
      projectPath: projectPath ? 'present' : 'missing',
      sessionId: sessionId || 'missing',
      planId: planId || 'none',
      repositoryUrl: repositoryUrl ? 'present' : 'missing',
      useSandbox,
    });

    if (!integration || !projectPath) {
      return new Response(
        JSON.stringify({ error: 'Missing integration or projectPath' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If sandbox mode is enabled, require repository URL
    if (useSandbox && !repositoryUrl) {
      return new Response(
        JSON.stringify({ error: 'Repository URL is required for sandbox mode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }


    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const context7Key = process.env.CONTEXT7_API_KEY;
    if (!context7Key) {
      return new Response(
        JSON.stringify({ error: 'CONTEXT7_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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

    // Check if user has sufficient credits
    const creditCheck = await checkUserCredits(supabase, user.id);
    if (creditCheck instanceof Error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to verify credits',
          type: 'credit_check_failed'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!creditCheck.hasCredits) {
      console.warn('[Insufficient Credits]', {
        user_id: user.id,
        email: user.email,
        remaining: creditCheck.remaining,
        total: creditCheck.total,
        used: creditCheck.used
      });

      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          type: 'insufficient_credits',
          credits: {
            remaining: creditCheck.remaining,
            total: creditCheck.total,
            used: creditCheck.used
          }
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Credit Check Passed]', {
      user_id: user.id,
      remaining: creditCheck.remaining
    });

    // Check if user is trying to generate additional plans (2nd or 3rd) without a paid role
    if (planId && !creditCheck.role) {
      console.warn('[Role Restriction]', {
        user_id: user.id,
        email: user.email,
        planId,
        role: creditCheck.role
      });

      return new Response(
        JSON.stringify({
          error: 'Upgrade required to generate additional plans',
          type: 'role_required',
          credits: {
            remaining: creditCheck.remaining,
            total: creditCheck.total,
            used: creditCheck.used
          }
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    let cliRunner: ICLIRunner | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        let newSessionId = sessionId;
        let controllerClosed = false;

        let sdkSessionId: string | undefined;

        // Helper to safely enqueue messages
        const safeEnqueue = (data: string) => {
          if (!controllerClosed) {
            try {
              controller.enqueue(encoder.encode(data));
            } catch (error) {
              console.error('Failed to enqueue data:', error);
              controllerClosed = true;
              // Kill CLI process when controller closes
              if (cliRunner) {
                console.log('[DEBUG] Killing CLI process due to controller error');
                cliRunner.kill();
              }
            }
          }
        };

        try {
          // Check if we have an existing session
          let existingStage: string | undefined;
          let existingSandboxId: string | undefined;
          let existingClarifications: string | undefined;
          if (sessionId) {
            console.log('[DEBUG] Looking up session:', sessionId);
            const { data, error: lookupError } = await supabase
              .from('sandbox_sessions')
              .select('id, status, expires_at, sdk_session_id, current_stage, sandbox_id, conversation_history')
              .eq('id', sessionId)
              .single();

            console.log('[DEBUG] Session lookup result:', {
              found: !!data,
              status: data?.status,
              hasClarifications: !!data?.conversation_history?.clarifications,
              lookupError
            });

            if (data) {
              // Session found, reuse it
              newSessionId = data.id;

              // If generating a specific plan, DON'T resume SDK session or stage
              // Start fresh with just that plan, but use existing clarifications
              if (planId) {
                existingClarifications = data.conversation_history?.clarifications || undefined;
                console.log('[DEBUG] Using existing clarifications for plan generation:', existingClarifications ? 'found' : 'none');
              } else {
                sdkSessionId = data.sdk_session_id || undefined;
                existingStage = data.current_stage || undefined;
              }

              existingSandboxId = data.sandbox_id || undefined;
              console.log('[DEBUG] Reusing session:', sessionId);
              console.log('[DEBUG] Plan ID:', planId);
              console.log('[DEBUG] Retrieved SDK session ID from DB:', data.sdk_session_id);
              console.log('[DEBUG] Final sdkSessionId value:', sdkSessionId);
              console.log('[DEBUG] Stage:', existingStage);
              console.log('[DEBUG] Existing sandbox ID:', existingSandboxId);
            } else {
              // Session not found or lookup error
              console.log('[DEBUG] Session not found or error, will create new one');
              newSessionId = null;
            }
          }

          // Create new session if needed
          if (!newSessionId) {
            console.log('[DEBUG] Creating new session for user:', user.id);

            const { data, error: insertError } = await supabase
              .from('sandbox_sessions')
              .insert({
                user_id: user.id,
                sandbox_id: `local-${Date.now()}`,
                integration,
                repo_url: projectPath,
                repository_url: repositoryUrl,
                branch: branch || 'main',
                conversation_history: [],
                status: 'active',
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('[DEBUG] Failed to create session:', insertError);
            } else if (data) {
              newSessionId = data.id;
              console.log('[DEBUG] Created new session:', newSessionId);
              // Send session ID to client
              const sessionData = JSON.stringify({ type: 'session', sessionId: data.id }) + '\n\n';
              safeEnqueue(`data: ${sessionData}`);
            } else {
              console.error('[DEBUG] Session insert returned no data');
            }
          }

          // Authentication logic has been moved to the factory function

          // State for CLI message handling
          let questionsReceived = false;
          const collectedPlans: any[] = [];
          let capturedSdkSessionId: string | undefined;
          let currentStage: string = 'start';

          // Message handlers (shared between sandbox and local runners)
          const messageHandlers = {
            onMessage: async (message: any) => {
              // Handle internal messages
              if (message.type === 'sandbox_created') {
                // Store the actual Vercel sandbox ID
                const actualSandboxId = message.sandboxId;
                console.log('[DEBUG] Captured Vercel sandbox ID:', actualSandboxId);

                if (newSessionId && actualSandboxId) {
                  const { error: updateError } = await supabase
                    .from('sandbox_sessions')
                    .update({ sandbox_id: actualSandboxId })
                    .eq('id', newSessionId);

                  if (updateError) {
                    console.error('[DEBUG] Error storing sandbox ID:', updateError);
                  } else {
                    console.log('[DEBUG] Successfully stored Vercel sandbox ID in database');
                  }
                }
              } else if (message.type === 'sdk_session') {
                // Capture SDK session ID (only store once)
                if (!capturedSdkSessionId || capturedSdkSessionId !== message.sessionId) {
                  capturedSdkSessionId = message.sessionId;
                  console.log('[DEBUG] Captured SDK session ID from CLI:', capturedSdkSessionId);

                  // Store SDK session ID in database if we have a database session
                  if (newSessionId && capturedSdkSessionId) {
                    console.log('[DEBUG] Storing SDK session ID in database. newSessionId:', newSessionId);
                    const { error: updateError } = await supabase
                      .from('sandbox_sessions')
                      .update({ sdk_session_id: capturedSdkSessionId })
                      .eq('id', newSessionId);

                    if (updateError) {
                      console.error('[DEBUG] Error storing SDK session ID:', updateError);
                    } else {
                      console.log('[DEBUG] Successfully stored SDK session ID in database');
                    }
                  } else {
                    console.log('[DEBUG] NOT storing SDK session ID. newSessionId:', newSessionId, 'capturedSdkSessionId:', capturedSdkSessionId);
                  }
                }
              } else if (message.type === 'stage') {
                // Update current stage
                currentStage = message.stage;
                console.log('Stage update:', currentStage);

                // Update stage in database
                if (newSessionId) {
                  await supabase
                    .from('sandbox_sessions')
                    .update({ current_stage: currentStage })
                    .eq('id', newSessionId);
                }

                // Forward stage message to client
                const progressData = JSON.stringify({
                  type: 'progress',
                  message: { type: 'stage', stage: currentStage }
                }) + '\n\n';
                safeEnqueue(`data: ${progressData}`);
              } else if (message.type === 'status') {
                // Forward status messages to client for progress display
                const progressData = JSON.stringify({
                  type: 'progress',
                  message: { type: 'status', message: message.message }
                }) + '\n\n';
                safeEnqueue(`data: ${progressData}`);
              } else if (message.type === 'questions') {
                questionsReceived = true;

                // Deduct 10 credits for generating questions
                await deductCredits(supabase, user.id, 10, 'Questions generated');

                // Save questions to database session
                if (newSessionId && message.questions) {
                  await updateConversationHistory(supabase, newSessionId, {
                    questions: message.questions
                  });
                  console.log('[DEBUG] Saved questions to session');
                }

                // Send questions to client
                const progressData = JSON.stringify({
                  type: 'progress',
                  message: {
                    type: 'questions',
                    questions: message.questions
                  }
                }) + '\n\n';
                safeEnqueue(`data: ${progressData}`);
                // Note: Clarifications are now passed via --clarifications argument
              } else if (message.type === 'plan') {
                // Collect plan
                const plan = message.plan;

                // Deduct 20 credits for:
                // 1. First plan (metadata) - collectedPlans.length === 0
                // 2. Full plan generation - when planId is provided
                const isFirstPlan = collectedPlans.length === 0;
                if (isFirstPlan || planId) {
                  await deductCredits(supabase, user.id, 20, `Plan generated: ${plan.title}`);
                }

                collectedPlans.push(plan);

                // Keep sections structure for proper formatting in frontend
                const formattedPlan = {
                  id: plan.id,
                  title: plan.title,
                  description: plan.description,
                  estimatedTime: plan.estimatedTime,
                  difficulty: plan.difficulty,
                  sections: plan.sections,
                  summaries: plan.summaries
                };

                // Send plan as progress for UI updates
                const progressData = JSON.stringify({
                  type: 'progress',
                  message: {
                    type: 'plan',
                    plan: formattedPlan
                  }
                }) + '\n\n';
                safeEnqueue(`data: ${progressData}`);

                // If this is the first plan, also send a "plan_ready" event so UI can show it immediately
                if (collectedPlans.length === 1) {
                  const firstPlanData = JSON.stringify({
                    type: 'plan_ready',
                    plans: [formattedPlan]
                  }) + '\n\n';
                  safeEnqueue(`data: ${firstPlanData}`);
                }

                // Save plans incrementally to database
                if (newSessionId) {
                  const formattedPlans = collectedPlans.map(p => ({
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    estimatedTime: p.estimatedTime,
                    difficulty: p.difficulty,
                    sections: p.sections,
                    summaries: p.summaries
                  }));

                  await updateConversationHistory(supabase, newSessionId, {
                    plans: formattedPlans,
                    clarifications: clarifications
                  });
                }
              } else {
                // Other internal messages (tool_call, tool_result, agent_response, status)
                const progressData = JSON.stringify({
                  type: 'progress',
                  message
                }) + '\n\n';
                safeEnqueue(`data: ${progressData}`);
              }
            },
            onError: (error: Error) => {
              console.error('CLI process error:', error);
              throw error;
            },
            onClose: async (code: number | null) => {
              console.log(`CLI process exited with code ${code}`);

              if (code === 0 && collectedPlans.length > 0) {
                // Keep sections structure for proper formatting in frontend
                const formattedPlans = collectedPlans.map(plan => ({
                  id: plan.id,
                  title: plan.title,
                  description: plan.description,
                  estimatedTime: plan.estimatedTime,
                  difficulty: plan.difficulty,
                  sections: plan.sections,
                  summaries: plan.summaries
                }));

                // Update session status and store plans
                if (newSessionId) {
                  await updateConversationHistory(
                    supabase,
                    newSessionId,
                    {
                      plans: formattedPlans,
                      clarifications: clarifications
                    },
                    { status: 'completed' }
                  );
                }

                // Send completion
                const completeData = JSON.stringify({
                  type: 'complete',
                  plans: formattedPlans,
                  sessionId: newSessionId
                }) + '\n\n';
                safeEnqueue(`data: ${completeData}`);
              } else if (code !== 0) {
                throw new Error(`CLI process failed with code ${code}`);
              }

              // Close controller after a brief delay to allow any pending messages
              setTimeout(() => {
                if (!controllerClosed) {
                  controllerClosed = true;
                  controller.close();
                }
              }, 100);
            }
          };

          // Create appropriate CLI runner based on mode
          // Use existing clarifications if generating a specific plan
          const finalClarifications = clarifications || existingClarifications;

          console.log('[API] finalClarifications:', finalClarifications ? 'found' : 'none');
          console.log('[API] planId:', planId);
          console.log('[API] sdkSessionId:', sdkSessionId);
          console.log('[API] existingStage:', existingStage);

          // Fetch additional prompts from Supabase
          const { data: promptsData } = await supabase
            .from('prompts')
            .select('content');

          // Convert to string
          const additionalInstructions = promptsData
            ?.map(row => row.content)
            .join('\n\n')
            || '';

          console.log('[API] additionalInstructions:', additionalInstructions ? 'found' : 'none');

          if (useSandbox) {
            // Use Vercel Sandbox CLI runner
            cliRunner = await createVercelSandboxCLIRunner(
              {
                integration,
                projectPath: '/vercel/sandbox',
                repoUrl: repositoryUrl,
                sandboxId: existingSandboxId, // Reuse existing Vercel sandbox if available
                installationId: installationId,
                clarifications: finalClarifications,
                sdkSessionId,
                existingStage,
                planId,
                apiKey,
                context7Key,
                additionalInstructions,
              },
              messageHandlers
            );
          } else {
            // Use local CLI runner
            cliRunner = createCLIRunner(
              {
                integration,
                projectPath,
                clarifications: finalClarifications,
                sessionId,
                sdkSessionId,
                existingStage,
                planId,
                apiKey,
                context7Key,
                additionalInstructions,
              },
              messageHandlers
            );
          }

          // Deduct 10 credits for starting analysis
          await deductCredits(supabase, user.id, 10, 'Analysis started');

          // Start the CLI process
          cliRunner.start();

        } catch (error) {
          console.error('Local analysis error:', error);

          // Update session status to failed
          if (newSessionId) {
            await supabase
              .from('sandbox_sessions')
              .update({ status: 'failed' })
              .eq('id', newSessionId);
          }

          // Kill CLI process if running
          if (cliRunner) {
            cliRunner.kill();
          }

          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }) + '\n\n';
          safeEnqueue(`data: ${errorData}`);
          if (!controllerClosed) {
            controllerClosed = true;
            controller.close();
          }
        }
      },
      cancel() {
        // Kill CLI process when stream is cancelled (user navigates away, connection drops, etc.)
        if (cliRunner) {
          console.log('[DEBUG] Stream cancelled - killing CLI process');
          cliRunner.kill();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze repository' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
