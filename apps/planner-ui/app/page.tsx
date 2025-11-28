"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Window from "./components/Window";
import IntegrationSelectScreen from "../components/IntegrationSelectScreen";
import AnalyzingScreen from "../components/AnalyzingScreen";
import ClarifyingScreen from "../components/ClarifyingScreen";
import PlansReadyScreen from "../components/PlansReadyScreen";
import PlanDetailWindow from "../components/PlanDetailWindow";
import NextStepsWindow from "../components/NextStepsWindow";
import GitHubConnectWindow from "../components/GitHubConnectWindow";
import SessionsWindow from "../components/SessionsWindow";
import SettingsWindow from "../components/SettingsWindow";
import ProgressBar from "../components/ProgressBar";
import UpgradeModal from "../components/UpgradeModal";
import 'highlight.js/styles/atom-one-dark.css';
import { fonts } from "../lib/fonts";

interface UserCredits {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
}

interface IntegrationPlan {
  id: number;
  title: string;
  description: string;
  steps?: string[]; // Old format (flat array)
  sections: { // New format (structured sections)
    setup: string[];
    integration: string[];
    verification: string[];
    nextSteps: string[];
  };
  summaries: {
    setup: string;
    integration: string;
    verification: string;
    nextSteps: string;
  };
  estimatedTime: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

type WorkflowStep = "loading" | "integration-select" | "analyzing" | "clarifying" | "generating" | "plans-ready" | "complete";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("loading");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [cwdPath, setCwdPath] = useState<string>("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plans, setPlans] = useState<IntegrationPlan[]>([]);
  const [isSettingSession, setIsSettingSession] = useState(false);
  const [showSessionsWindow, setShowSessionsWindow] = useState(false);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ remaining: number; total: number; used: number } | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<'insufficient_credits' | 'role_required'>('insufficient_credits');

  // Handle session tokens from URL (when redirected from sourcewizard-web)
  useEffect(() => {
    const handleSessionTokens = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[Planner] Setting session from URL tokens');
        setIsSettingSession(true);
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data.session) {
          console.log('[Planner] Session set successfully:', data.session.user.email);
          // Clean URL
          window.history.replaceState({}, '', '/planner');
          // Wait a bit for the auth state to propagate
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error('[Planner] Error setting session:', error);
        }
        setIsSettingSession(false);
      }
    };

    handleSessionTokens();
  }, []);

  // Redirect to login if not authenticated (but wait if we're setting session from URL)
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isSettingSession) {
      const loginUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/login?app=planner'
        : 'https://sourcewizard.ai/login?app=planner';
      window.location.href = loginUrl;
    }
  }, [authLoading, isAuthenticated, isSettingSession]);

  // Get user email from Supabase auth
  useEffect(() => {
    async function getUserEmail() {
      if (isAuthenticated && !authLoading) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      }
    }
    getUserEmail();
  }, [isAuthenticated, authLoading]);

  // Check for GitHub repositories after authentication
  useEffect(() => {
    async function checkGitHubRepositories() {
      if (!isAuthenticated || authLoading || isSettingSession) {
        console.log('[GitHub Check] Skipping check:', { isAuthenticated, authLoading, isSettingSession });
        return;
      }

      try {
        console.log('[GitHub Check] Checking for repositories...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[GitHub Check] No session found');
          return;
        }

        const response = await fetch('/api/github-repositories', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        console.log('[GitHub Check] API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[GitHub Check] Installations:', data.installations);
          const hasInstallations = data.installations && data.installations.length > 0;
          setHasGitHubRepo(hasInstallations);

          if (!hasInstallations) {
            console.log('[GitHub Check] No installations found, showing popup');
            setShowGitHubConnect(true);
          } else {
            console.log('[GitHub Check] Found installations, not showing popup');
          }
        } else {
          console.error('[GitHub Check] API error:', await response.text());
        }
      } catch (error) {
        console.error('Error checking GitHub repositories:', error);
      }
    }

    checkGitHubRepositories();
  }, [isAuthenticated, authLoading, isSettingSession]);
  const [isLoading, setIsLoading] = useState(false);
  const [openPlanWindows, setOpenPlanWindows] = useState<Array<{ plan: IntegrationPlan; position: { x: number; y: number } }>>([]);
  const [topWindowId, setTopWindowId] = useState<number | null>(null);
  const [nextStepsWindowPlan, setNextStepsWindowPlan] = useState<IntegrationPlan | null>(null);
  const [showSettingsWindow, setShowSettingsWindow] = useState(false);
  const [backgroundPattern, setBackgroundPattern] = useState('grid');
  const [useSandbox, setUseSandbox] = useState(false);

  // Load background pattern and sandbox mode from localStorage after main window is loaded
  useEffect(() => {
    if (!authLoading && !isSettingSession && isAuthenticated && workflowStep !== 'loading') {
      const savedPattern = localStorage.getItem('backgroundPattern');
      if (savedPattern) {
        setBackgroundPattern(savedPattern);
      } else {
        setBackgroundPattern('grid');
      }

      const savedUseSandbox = localStorage.getItem('useSandbox');
      if (savedUseSandbox !== null) {
        setUseSandbox(savedUseSandbox === 'true');
      }
    }
  }, [authLoading, isSettingSession, isAuthenticated, workflowStep]);

  const [showWelcomeMessage] = useState(false);
  const [showUpgradeOptions, setShowUpgradeOptions] = useState(false);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  const [credits] = useState<UserCredits>({
    total_credits: 100,
    used_credits: 25,
    remaining_credits: 75,
  });
  const [showGitHubConnect, setShowGitHubConnect] = useState(false);
  const [hasGitHubRepo, setHasGitHubRepo] = useState<boolean | null>(null);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<string>('');
  const [selectedGitHubBranch, setSelectedGitHubBranch] = useState<string>('');
  const [githubInstallationId, setGithubInstallationId] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Fetch CWD and analyze repository on mount
  useEffect(() => {
    async function initializeApp() {
      try {
        // Check for session ID in URL
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');

        // Fetch CWD
        const cwdResponse = await fetch('/api/cwd');
        const cwdData = await cwdResponse.json();
        setSelectedFolder(cwdData.folderName);
        setCwdPath(cwdData.cwd);

        // Try to restore session if provided
        if (sessionParam) {
          try {
            const sessionResponse = await fetch(`/api/session?id=${sessionParam}`);
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              setSessionId(sessionParam);
              setSelectedIntegration(sessionData.integration);
              setInputValue(sessionData.integration); // Pre-fill the textarea
              // Ensure conversationHistory is always an array
              const history = sessionData.conversationHistory;
              setConversationHistory(Array.isArray(history) ? history : []);

              console.log('Restored session:', {
                id: sessionData.id,
                status: sessionData.status,
                stage: sessionData.currentStage,
                hasConversationHistory: !!sessionData.conversationHistory,
                conversationHistory: sessionData.conversationHistory
              });

              // Restore plans if they exist in conversation history (regardless of status)
              if (sessionData.conversationHistory?.plans && Array.isArray(sessionData.conversationHistory.plans) && sessionData.conversationHistory.plans.length > 0) {
                setPlans(sessionData.conversationHistory.plans);

                // Restore all session data needed for generating plans
                if (sessionData.repo_url) {
                  setCwdPath(sessionData.repo_url);
                }
                if (sessionData.repository_url) {
                  setSelectedGitHubRepo(sessionData.repository_url);
                }
                if (sessionData.branch) {
                  setSelectedGitHubBranch(sessionData.branch);
                }
                // Get installation ID from repositories API
                if (sessionData.repository_url) {
                  const { data: { session: authSession } } = await supabase.auth.getSession();
                  if (authSession) {
                    const reposResponse = await fetch('/api/github-repositories', {
                      headers: {
                        'Authorization': `Bearer ${authSession.access_token}`,
                      },
                    });
                    if (reposResponse.ok) {
                      const reposData = await reposResponse.json();
                      if (reposData.installations && reposData.installations.length > 0) {
                        // Extract owner from repository URL
                        const match = sessionData.repository_url.match(/github\.com\/([^\/]+)\//);
                        if (match) {
                          const owner = match[1];
                          // Find the installation for this owner
                          const installation = reposData.installations.find((inst: any) => inst.name === owner);
                          if (installation) {
                            setGithubInstallationId(installation.github_id);
                          }
                        }
                      }
                    }
                  }
                }

                setWorkflowStep('plans-ready');
                console.log('✅ Restored session with plans:', sessionData.conversationHistory.plans.length);
                return; // Don't set workflow to integration-select
              }

              console.log('⚠️ Restored session but no plans found - status:', sessionData.status, 'stage:', sessionData.currentStage);

              // If session is active, automatically resume from the saved stage
              if (sessionData.status === 'active' && sessionData.currentStage) {
                console.log('🔄 Auto-resuming session from stage:', sessionData.currentStage);

                // Special handling for questions stage - show saved questions instead of calling CLI
                if (sessionData.currentStage === 'questions' && sessionData.conversationHistory?.questions) {
                  console.log('📋 Resuming from questions stage - loading saved questions');

                  // Restore session data needed for continuing
                  if (sessionData.repo_url) {
                    setCwdPath(sessionData.repo_url);
                  }
                  if (sessionData.repository_url) {
                    setSelectedGitHubRepo(sessionData.repository_url);
                  }
                  if (sessionData.branch) {
                    setSelectedGitHubBranch(sessionData.branch);
                  }

                  // Load and show the saved questions
                  const savedQuestions = sessionData.conversationHistory.questions;
                  if (Array.isArray(savedQuestions)) {
                    setParsedQuestions(savedQuestions.map((q: any) => ({
                      ...q,
                      selected: null
                    })));
                    setCurrentQuestionIndex(0);
                    setWorkflowStep('clarifying');
                  }
                  return;
                }

                // For other stages, resume via API
                setWorkflowStep('analyzing');
                setIsAnalyzing(true);
                setIsLoading(true);
                setProgressMessages([`Resuming from stage: ${sessionData.currentStage}`]);

                // Start streaming from the API (it will resume from the saved stage)
                // Pass cwdPath explicitly since we have it from the fetch above
                resumeSession(sessionData, cwdData.cwd);
                return;
              }

              // If session is completed or failed, show integration select with pre-filled query
              setWorkflowStep('integration-select');
              console.log('📝 Session completed/failed - showing integration select with saved query');
              return;
            } else {
              console.error('Failed to restore session:', await sessionResponse.text());
              console.log('Failed to restore session - showing integration select');
            }
          } catch (sessionError) {
            console.error('Error restoring session:', sessionError);
          }
        }

        setWorkflowStep("integration-select");
      } catch (error) {
        console.error('Failed to initialize:', error);
        setSelectedFolder('Unknown Project');
        setCwdPath('');
        setWorkflowStep("integration-select");
      }
    }
    initializeApp();
  }, []);

  // Handle chat input submission
  const [inputValue, setInputValue] = useState("");

  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [isGeneratingOutput, setIsGeneratingOutput] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'active' | 'thinking' | 'closed'>('active');
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string>("");
  const [clarificationResponse, setClarificationResponse] = useState<string>("");
  const [generatingPlanIds, setGeneratingPlanIds] = useState<number[]>([]);
  const [planProgressMessages, setPlanProgressMessages] = useState<Record<number, string[]>>({});
  const [parsedQuestions, setParsedQuestions] = useState<Array<{
    question: string;
    options: string[];
    selected: string | null;
    additionalInfo?: string;
  }>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
    };
  };

  // Function to resume a session by connecting to the SSE stream
  const resumeSession = async (sessionData: any, projectPath: string) => {
    try {
      const endpoint = '/api/analyze';
      const requestBody = {
        integration: sessionData.integration,
        projectPath: projectPath,
        sessionId: sessionData.id,
        useSandbox: useSandbox,
        installationId: null, // Will be loaded from session in backend
      };

      console.log('Resuming session with endpoint:', endpoint, 'body:', requestBody);

      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Check for insufficient credits or role required error (402 Payment Required)
        if (response.status === 402) {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            if ((errorData.type === 'insufficient_credits' || errorData.type === 'role_required') && errorData.credits) {
              console.warn(`[Resume Session] ${errorData.type === 'role_required' ? 'Upgrade required' : 'Insufficient credits'}`);
              setCreditsInfo(errorData.credits);
              setUpgradeReason(errorData.type);
              setShowInsufficientCreditsModal(true);
              setIsAnalyzing(false);
              setIsLoading(false);
              setWorkflowStep('integration-select');
              return;
            }
          } catch (e) {
            // Failed to parse error, fall through to generic error
          }
        }
        throw new Error('Failed to resume session');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              const msg = data.message;

              if (msg.type === 'stage') {
                setProgressMessages(prev => [...prev, `📍 Stage: ${msg.stage}`]);
              } else if (msg.type === 'questions') {
                if (msg.questions && Array.isArray(msg.questions)) {
                  setParsedQuestions(msg.questions.map((q: any) => ({
                    ...q,
                    selected: null
                  })));
                  setCurrentQuestionIndex(0);
                  setWorkflowStep('clarifying');
                  setIsLoading(false);
                }
              } else if (msg.type === 'plan') {
                const plan = msg.plan;
                setProgressMessages(prev => [...prev, `📋 Generated ${plan.difficulty} plan: ${plan.title}`]);

                setPlans(prev => {
                  if (prev.some(p => p.id === plan.id)) {
                    return prev;
                  }
                  return [...prev, plan];
                });
              } else if (msg.type === 'tool_call') {
                const args = JSON.stringify(msg.tool_params, null, 2);
                setProgressMessages(prev => [...prev, `🔧 ${msg.tool_name}(${args})`]);
              } else if (msg.type === 'tool_result') {
                setProgressMessages(prev => [...prev, `✓ Tool completed`]);
              } else if (msg.type === 'agent_response') {
                setProgressMessages(prev => [...prev, msg.text]);
              } else if (msg.type === 'status') {
                setProgressMessages(prev => [...prev, msg.message]);
              }
            } else if (data.type === 'plan_ready') {
              if (data.plans && data.plans.length > 0) {
                setWorkflowStep("plans-ready");
                setIsAnalyzing(false);
                setIsLoading(false);
              }
            } else if (data.type === 'complete') {
              setPlans(data.plans);
              setIsAnalyzing(false);
              setIsLoading(false);
              setWorkflowStep("plans-ready");
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error resuming session:', error);
      setIsAnalyzing(false);
      setIsLoading(false);
      setProgressMessages([]);
      alert(`Failed to resume session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setWorkflowStep("integration-select");
    }
  };

  // Update URL when session ID changes
  useEffect(() => {
    if (sessionId) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionId);
      window.history.replaceState({}, '', url.toString());
      console.log('Updated URL with session:', sessionId);
    }
  }, [sessionId]);

  // Handle reset when "Try Different Integration" is clicked
  const handleReset = () => {
    console.log('Resetting planner state');
    setSessionId(null);
    setPlans([]);
    setSelectedIntegration('');
    setInputValue('');
    setConversationHistory([]);
    setWorkflowStep('integration-select');
    setSelectedGitHubRepo('');
    setSelectedGitHubBranch('');
    setGithubInstallationId(null);
    setOpenPlanWindows([]);
    setProgressMessages([]);
    setIsAnalyzing(false);
    setIsLoading(false);
    setParsedQuestions([]);
    setCurrentQuestionIndex(0);

    // Clear URL session parameter
    window.history.pushState({}, '', '/planner');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userInput = inputValue.trim();
    setSelectedIntegration(userInput);
    setInputValue("");
    setWorkflowStep("analyzing");
    setIsAnalyzing(true);
    setIsLoading(true);
    setProgressMessages([]);
    setIsGeneratingOutput(false);
    setStreamStatus('active');

    try {
      // Call the analyze API with SSE
      const endpoint = '/api/analyze';
      const requestBody = {
        integration: userInput,
        projectPath: cwdPath,
        sessionId: sessionId,
        repositoryUrl: selectedGitHubRepo,
        branch: selectedGitHubBranch,
        useSandbox: useSandbox,
        installationId: githubInstallationId,
      };

      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Check for insufficient credits or role required error (402 Payment Required)
        if (response.status === 402) {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            if ((errorData.type === 'insufficient_credits' || errorData.type === 'role_required') && errorData.credits) {
              console.warn(`[Analysis Start] ${errorData.type === 'role_required' ? 'Upgrade required' : 'Insufficient credits'}`);
              setCreditsInfo(errorData.credits);
              setUpgradeReason(errorData.type);
              setShowInsufficientCreditsModal(true);
              setIsAnalyzing(false);
              setIsLoading(false);
              setWorkflowStep('integration-select');
              return;
            }
          } catch (e) {
            // Failed to parse error, fall through to generic error
          }
        }
        throw new Error('Failed to start analysis');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'session') {
              // Store session ID for reusing sandbox/local
              setSessionId(data.sessionId);
            } else if (data.type === 'progress') {
              const msg = data.message;

              // Store message in conversation history
              setConversationHistory(prev => {
                // Ensure prev is an array before spreading
                const prevArray = Array.isArray(prev) ? prev : [];
                return [...prevArray, msg];
              });

              // Handle different message types
              if (msg.type === 'questions') {
                // Questions from CLI
                if (msg.questions && Array.isArray(msg.questions)) {
                  setParsedQuestions(msg.questions.map((q: any) => ({
                    ...q,
                    selected: null
                  })));
                  setCurrentQuestionIndex(0);
                  setWorkflowStep('clarifying');
                  setIsLoading(false);
                }
              } else if (msg.type === 'plan') {
                // Plan from CLI - add to plans array immediately
                const plan = msg.plan;
                setProgressMessages(prev => [...prev, `Generated ${plan.difficulty} plan: ${plan.title}`]);

                // Add plan to the plans array incrementally
                setPlans(prev => {
                  // Check if plan already exists (by id)
                  if (prev.some(p => p.id === plan.id)) {
                    return prev;
                  }
                  const newPlans = [...prev, plan];

                  // If this is the first plan, switch to plans-ready state
                  if (newPlans.length === 1) {
                    setWorkflowStep("plans-ready");
                    setIsAnalyzing(false);
                    setIsLoading(false);
                  }

                  return newPlans;
                });
              } else if (msg.type === 'tool_call') {
                // Tool call from CLI
                const args = JSON.stringify(msg.tool_params, null, 2);
                setProgressMessages(prev => [...prev, `${msg.tool_name}(${args})`]);
              } else if (msg.type === 'tool_result') {
                // Tool result from CLI
                setProgressMessages(prev => [...prev, `Tool completed`]);
              } else if (msg.type === 'agent_response') {
                // Agent text response from CLI
                setProgressMessages(prev => [...prev, msg.text]);
              } else if (msg.type === 'status') {
                // Status message from CLI
                setProgressMessages(prev => [...prev, msg.message]);
              } else if (msg.type === 'assistant') {
                // Extract text from assistant message content
                const message = msg.message;
                setStreamStatus('active');
                if (message && message.content) {
                  let hasTextMessage = false;
                  let textContent = '';

                  for (const block of message.content) {
                    if (block.type === 'text' && block.text) {
                      hasTextMessage = true;
                      textContent = block.text;
                      setProgressMessages(prev => [...prev, block.text]);
                      setIsGeneratingOutput(false);
                    } else if (block.type === 'tool_use') {
                      // Show tool name with arguments
                      const args = JSON.stringify(block.input, null, 2);
                      setProgressMessages(prev => [...prev, `🔧 ${block.name}(${args})`]);
                      setIsGeneratingOutput(false);
                    }
                  }

                  // Check if assistant is asking questions (stop reason is not tool_use and has text)
                  if (hasTextMessage && message.stop_reason !== 'tool_use' && !message.content.some((b: any) => b.type === 'tool_use')) {
                    // Agent finished analysis and is asking questions
                    setClarifyingQuestions(textContent);

                    // Try to parse JSON questions
                    try {
                      const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/);
                      if (jsonMatch) {
                        const questionsData = JSON.parse(jsonMatch[1]);
                        if (questionsData.questions && Array.isArray(questionsData.questions)) {
                          setParsedQuestions(questionsData.questions.map((q: any) => ({
                            ...q,
                            selected: null
                          })));
                          setCurrentQuestionIndex(0);
                        }
                      }
                    } catch (e) {
                      console.error('Failed to parse questions JSON:', e);
                    }

                    setWorkflowStep('clarifying');
                    setIsLoading(false);
                  }

                  // After tool use, model will be thinking
                  if (message.content.some((b: any) => b.type === 'tool_use')) {
                    setStreamStatus('thinking');
                  }
                }
              } else if (msg.type === 'user') {
                // Check for tool errors in user messages
                const message = msg.message;
                if (message && message.content && Array.isArray(message.content)) {
                  for (const block of message.content) {
                    if (block.type === 'tool_result' && block.is_error) {
                      setProgressMessages(prev => [...prev, `❌ Error: ${block.content}`]);
                    }
                  }
                }
              } else if (msg.type === 'tool_result') {
                // Tool completed - show which tool
                const toolInfo = msg.message?.tool_use_id || msg.tool_name || 'tool';
                setProgressMessages(prev => [...prev, `✓ Tool completed`]);
                setIsGeneratingOutput(false);
                setStreamStatus('thinking');
              } else if (msg.type === 'result') {
                // Agent finished analysis, now generating structured output
                setIsGeneratingOutput(true);
                setStreamStatus('closed');
                setProgressMessages(prev => [...prev, '📝 Analysis complete, generating plans...']);
              } else if (msg.type === 'system' && msg.subtype === 'init') {
                // System initialization
                setProgressMessages(prev => [...prev, '🚀 Agent initialized']);
                setStreamStatus('active');
              }
            } else if (data.type === 'plan_ready') {
              // First plan is ready - show the UI immediately
              if (data.plans && data.plans.length > 0) {
                setWorkflowStep("plans-ready");
                setIsAnalyzing(false);
                setIsLoading(false);
              }
            } else if (data.type === 'complete') {
              // Final plans received - ensure all plans are set
              setPlans(data.plans);
              setIsAnalyzing(false);
              setIsLoading(false);
              setWorkflowStep("plans-ready");
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing repository:', error);
      setIsAnalyzing(false);
      setIsLoading(false);
      setProgressMessages([]);
      alert(`Failed to analyze repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setWorkflowStep("integration-select");
    }
  };

  // Handle session selection
  const handleSessionSelect = async (session: any) => {
    // Load plans from the session
    if (session.conversation_history?.plans) {
      setPlans(session.conversation_history.plans);
      setSelectedIntegration(session.integration);
      setSessionId(session.id);

      // Restore all session data needed for generating plans
      if (session.repo_url) {
        setCwdPath(session.repo_url);
      }
      if (session.repository_url) {
        setSelectedGitHubRepo(session.repository_url);
      }
      if (session.branch) {
        setSelectedGitHubBranch(session.branch);
      }
      // Get installation ID from repositories API
      if (session.repository_url) {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const reposResponse = await fetch('/api/github-repositories', {
            headers: {
              'Authorization': `Bearer ${authSession.access_token}`,
            },
          });
          if (reposResponse.ok) {
            const reposData = await reposResponse.json();
            if (reposData.installations && reposData.installations.length > 0) {
              // Extract owner from repository URL
              const match = session.repository_url.match(/github\.com\/([^\/]+)\//);
              if (match) {
                const owner = match[1];
                // Find the installation for this owner
                const installation = reposData.installations.find((inst: any) => inst.name === owner);
                if (installation) {
                  setGithubInstallationId(installation.github_id);
                }
              }
            }
          }
        }
      }

      setWorkflowStep('plans-ready');
      setShowSessionsWindow(false);

      // Update URL with session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', session.id);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Handle generating full plan for metadata-only plans
  const handleGenerateFullPlan = async (planId: number) => {
    if (!sessionId) {
      console.error('Missing sessionId');
      return;
    }

    // Get access token from session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No session found');
      return;
    }

    // Find the plan
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      console.error('Plan not found');
      return;
    }

    setGeneratingPlanIds(prev => [...prev, planId]);
    setPlanProgressMessages(prev => ({ ...prev, [planId]: ['Starting plan generation...'] }));

    try {
      const requestBody = {
        integration: selectedIntegration,
        projectPath: cwdPath,
        sessionId: sessionId,
        repositoryUrl: selectedGitHubRepo,
        branch: selectedGitHubBranch,
        useSandbox: useSandbox,
        installationId: githubInstallationId,
        planId: planId, // Generate only this specific plan
      };

      console.log('handleGenerateFullPlan - Request body:', requestBody);
      console.log('handleGenerateFullPlan - Missing fields:', {
        integration: !selectedIntegration,
        projectPath: !cwdPath,
        sessionId: !sessionId,
        repositoryUrl: !selectedGitHubRepo,
        branch: !selectedGitHubBranch,
        installationId: !githubInstallationId,
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();

        // Check for insufficient credits or role required error (402 Payment Required)
        if (response.status === 402) {
          try {
            const errorData = JSON.parse(errorText);
            if ((errorData.type === 'insufficient_credits' || errorData.type === 'role_required') && errorData.credits) {
              console.warn(`[Plan Generation] ${errorData.type === 'role_required' ? 'Upgrade required for additional plans' : 'Insufficient credits'}`);
              setCreditsInfo(errorData.credits);
              setUpgradeReason(errorData.type);
              setShowInsufficientCreditsModal(true);
              setGeneratingPlanIds(prev => prev.filter(id => id !== planId));
              setIsLoading(false);
              return;
            }
          } catch (e) {
            // Failed to parse error, fall through to generic error
          }
        }

        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const dataStr = line.substring(6);
          try {
            const data = JSON.parse(dataStr);

            if (data.type === 'progress' && data.message) {
              const msg = data.message;

              // Open the plan window on first progress message
              if (!openPlanWindows.find(w => w.plan.id === planId)) {
                const planNumber = plans.findIndex(p => p.id === planId) + 1;
                const windowPosition = {
                  x: 100 + planNumber * 30,
                  y: 50 + planNumber * 30
                };
                setOpenPlanWindows(prev => [...prev, { plan, position: windowPosition }]);
                setTopWindowId(planId);
              }

              // Add progress messages
              if (msg.type === 'stage') {
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), `📍 Stage: ${msg.stage}`]
                }));
              } else if (msg.type === 'tool_call') {
                const args = JSON.stringify(msg.tool_params).substring(0, 50);
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), `🔧 ${msg.tool_name}(${args}...)`]
                }));
              } else if (msg.type === 'tool_result') {
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), `✓ Tool completed`]
                }));
              } else if (msg.type === 'agent_response' && msg.text) {
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), msg.text]
                }));
              } else if (msg.type === 'status') {
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), msg.message]
                }));
              } else if (msg.type === 'plan') {
                const plan = msg.plan;
                // Update the plan in the array
                setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
                setPlanProgressMessages(prev => ({
                  ...prev,
                  [planId]: [...(prev[planId] || []), `📋 Generated ${plan.difficulty} plan: ${plan.title}`]
                }));
              }
            } else if (data.type === 'complete' && data.plans) {
              // Update with the complete plan
              const updatedPlan = data.plans.find((p: any) => p.id === planId);
              if (updatedPlan) {
                setPlans(prev => prev.map(p => p.id === planId ? updatedPlan : p));
              }
              setPlanProgressMessages(prev => ({
                ...prev,
                [planId]: [...(prev[planId] || []), '✅ Plan generation complete!']
              }));
            } else if (data.type === 'error') {
              console.error('Error generating plan:', data.error);
              setPlanProgressMessages(prev => ({
                ...prev,
                [planId]: [...(prev[planId] || []), `❌ Error: ${data.error}`]
              }));
            }
          } catch (error) {
            console.error('Failed to parse SSE data:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error generating full plan:', error);
      setPlanProgressMessages(prev => ({
        ...prev,
        [planId]: [...(prev[planId] || []), `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }));
    } finally {
      setGeneratingPlanIds(prev => prev.filter(id => id !== planId));
    }
  };

  // Handle upgrade selection
  const handleUpgradeSelect = async (
    mailchimpTag: string,
    planName: string
  ) => {
    setShowUpgradeOptions(false);
    setShowUpgradeMessage(true);
  };

  // Show loading while checking auth or setting session
  if (authLoading || isSettingSession) {
    return (
      <Window
        title=""
        loading={true}
        currentStep="loading"
        onMyPlansClick={() => setShowSessionsWindow(true)}
        onSettingsClick={() => setShowSettingsWindow(true)}
        backgroundPattern={backgroundPattern}
        userEmail={userEmail}
        onReset={handleReset}
      >
        <div />
      </Window>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Window
        title=""
        loading={isLoading || workflowStep === "loading"}
        currentStep={workflowStep}
        questionProgress={workflowStep === "clarifying" && parsedQuestions.length > 0 ? `Question ${currentQuestionIndex + 1} of ${parsedQuestions.length}` : undefined}
        onMyPlansClick={() => setShowSessionsWindow(true)}
        onSettingsClick={() => setShowSettingsWindow(true)}
        backgroundPattern={backgroundPattern}
        userEmail={userEmail}
        onReset={handleReset}
      >
        <div className={workflowStep === "clarifying" || workflowStep === "integration-select" ? "h-full" : "space-y-4 p-6"}>

          {/* Chat Interface Step */}
          {workflowStep === "integration-select" && (
            <IntegrationSelectScreen
              selectedFolder={selectedFolder}
              cwdPath={cwdPath}
              sessionId={sessionId}
              selectedIntegration={selectedIntegration}
              inputValue={inputValue}
              setInputValue={setInputValue}
              handleSubmit={handleSubmit}
              onRepositoryChange={setSelectedGitHubRepo}
              onBranchChange={setSelectedGitHubBranch}
              onInstallationIdChange={setGithubInstallationId}
            />
          )}

          {/* Analyzing Step */}
          {workflowStep === "analyzing" && (
            <AnalyzingScreen
              selectedFolder={selectedFolder}
              selectedIntegration={selectedIntegration}
              progressMessages={progressMessages}
              streamStatus={streamStatus}
              isGeneratingOutput={isGeneratingOutput}
            />
          )}

          {/* Generating Step */}
          {workflowStep === "generating" && (
            <AnalyzingScreen
              selectedFolder={selectedFolder}
              selectedIntegration={selectedIntegration}
              progressMessages={progressMessages}
              streamStatus={streamStatus}
              isGeneratingOutput={isGeneratingOutput}
            />
          )}

          {/* Clarifying Step */}
          {workflowStep === "clarifying" && (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-8 pt-4 pb-2">
                {/* Header */}
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-lg font-bold" style={{ fontFamily: fonts.mono }}>
                    {selectedIntegration} setup
                  </h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-4">
                {parsedQuestions.length > 0 ? (
                  <div className="max-w-4xl mx-auto">
                    <form onSubmit={async (e) => {
                      e.preventDefault();

                      const currentQuestion = parsedQuestions[currentQuestionIndex];

                      // Check if current question is answered
                      if (!currentQuestion.selected) {
                        // Silently return without alert
                        return;
                      }

                      // If not the last question, go to next
                      if (currentQuestionIndex < parsedQuestions.length - 1) {
                        setCurrentQuestionIndex(currentQuestionIndex + 1);
                        return;
                      }

                      // All questions answered, submit
                      const response = parsedQuestions.map((q, idx) =>
                        `${idx + 1}. ${q.question}\n   Answer: ${q.selected}`
                      ).join('\n\n');

                      // Continue analysis with clarifications - switch to generating state
                      setWorkflowStep("generating");
                      setIsLoading(true);
                      setProgressMessages([]);

                      try {
                        // Continue analysis with clarifications
                        const endpoint = '/api/analyze';
                        const requestBody = {
                          integration: selectedIntegration,
                          projectPath: cwdPath,
                          clarifications: response,
                          sessionId: sessionId,
                          repositoryUrl: selectedGitHubRepo,
                          branch: selectedGitHubBranch,
                          useSandbox: useSandbox,
                          installationId: githubInstallationId,
                        };

                        const headers = await getAuthHeaders();
                        const apiResponse = await fetch(endpoint, {
                          method: 'POST',
                          headers,
                          body: JSON.stringify(requestBody),
                        });

                        if (!apiResponse.ok) {
                          const errorText = await apiResponse.text();

                          // Check for insufficient credits or role required error (402 Payment Required)
                          if (apiResponse.status === 402) {
                            try {
                              const errorData = JSON.parse(errorText);
                              if ((errorData.type === 'insufficient_credits' || errorData.type === 'role_required') && errorData.credits) {
                                console.warn(`[Continue Analysis] ${errorData.type === 'role_required' ? 'Upgrade required' : 'Insufficient credits'}`);
                                setCreditsInfo(errorData.credits);
                                setUpgradeReason(errorData.type);
                                setShowInsufficientCreditsModal(true);
                                setIsLoading(false);
                                setWorkflowStep('integration-select');
                                return;
                              }
                            } catch (e) {
                              // Failed to parse error, fall through to generic error
                            }
                          }

                          console.error('API error response:', errorText);
                          throw new Error(`Failed to continue analysis: ${errorText}`);
                        }

                        const reader = apiResponse.body?.getReader();
                        const decoder = new TextDecoder();

                        if (!reader) {
                          throw new Error('No response body');
                        }

                        let buffer = '';

                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;

                          buffer += decoder.decode(value, { stream: true });
                          const lines = buffer.split('\n\n');
                          buffer = lines.pop() || '';

                          for (const line of lines) {
                            if (line.startsWith('data: ')) {
                              const data = JSON.parse(line.slice(6));

                              if (data.type === 'session') {
                                // Store session ID
                                setSessionId(data.sessionId);
                              } else if (data.type === 'progress') {
                                const msg = data.message;

                                // Handle different message types (same as initial request)
                                if (msg.type === 'questions') {
                                  // Questions from CLI (shouldn't happen after clarification, but handle it)
                                  if (msg.questions && Array.isArray(msg.questions)) {
                                    setParsedQuestions(msg.questions.map((q: any) => ({
                                      ...q,
                                      selected: null
                                    })));
                                    setCurrentQuestionIndex(0);
                                    setWorkflowStep('clarifying');
                                    setIsLoading(false);
                                  }
                                } else if (msg.type === 'plan') {
                                  // Plan from CLI - add to plans array immediately
                                  const plan = msg.plan;
                                  setProgressMessages(prev => [...prev, `Generated ${plan.difficulty} plan: ${plan.title}`]);

                                  // Add plan to the plans array incrementally
                                  setPlans(prev => {
                                    // Check if plan already exists (by id)
                                    if (prev.some(p => p.id === plan.id)) {
                                      return prev;
                                    }
                                    const newPlans = [...prev, plan];

                                    // If this is the first plan, switch to plans-ready state
                                    if (newPlans.length === 1) {
                                      setWorkflowStep("plans-ready");
                                      setIsAnalyzing(false);
                                      setIsLoading(false);
                                    }

                                    return newPlans;
                                  });
                                } else if (msg.type === 'tool_call') {
                                  // Tool call from CLI
                                  const args = JSON.stringify(msg.tool_params, null, 2);
                                  setProgressMessages(prev => [...prev, `${msg.tool_name}(${args})`]);
                                } else if (msg.type === 'tool_result') {
                                  // Tool result from CLI
                                  setProgressMessages(prev => [...prev, `Tool completed`]);
                                } else if (msg.type === 'agent_response') {
                                  // Agent text response from CLI
                                  setProgressMessages(prev => [...prev, msg.text]);
                                } else if (msg.type === 'status') {
                                  // Status message from CLI
                                  setProgressMessages(prev => [...prev, msg.message]);
                                } else if (msg.type === 'assistant') {
                                  // Sandbox assistant messages (kept for compatibility)
                                  const message = msg.message;
                                  setStreamStatus('active');
                                  if (message && message.content) {
                                    for (const block of message.content) {
                                      if (block.type === 'text' && block.text) {
                                        setProgressMessages(prev => [...prev, block.text]);
                                        setIsGeneratingOutput(false);
                                      } else if (block.type === 'tool_use') {
                                        const args = JSON.stringify(block.input, null, 2);
                                        setProgressMessages(prev => [...prev, `🔧 ${block.name}(${args})`]);
                                        setIsGeneratingOutput(false);
                                      }
                                    }
                                    if (message.content.some((b: any) => b.type === 'tool_use')) {
                                      setStreamStatus('thinking');
                                    }
                                  }
                                } else if (msg.type === 'user') {
                                  const message = msg.message;
                                  if (message && message.content && Array.isArray(message.content)) {
                                    for (const block of message.content) {
                                      if (block.type === 'tool_result' && block.is_error) {
                                        setProgressMessages(prev => [...prev, `❌ Error: ${block.content}`]);
                                      }
                                    }
                                  }
                                } else if (msg.type === 'result') {
                                  setIsGeneratingOutput(true);
                                  setStreamStatus('closed');
                                  setProgressMessages(prev => [...prev, '📝 Analysis complete, generating plans...']);
                                } else if (msg.type === 'system' && msg.subtype === 'init') {
                                  setProgressMessages(prev => [...prev, '🚀 Agent initialized']);
                                  setStreamStatus('active');
                                }
                              } else if (data.type === 'plan_ready') {
                                // First plan is ready - show the UI immediately
                                if (data.plans && data.plans.length > 0) {
                                  setWorkflowStep("plans-ready");
                                  setIsAnalyzing(false);
                                  setIsLoading(false);
                                }
                              } else if (data.type === 'complete') {
                                // Final plans received
                                setPlans(data.plans);
                                setIsAnalyzing(false);
                                setIsLoading(false);
                                setWorkflowStep("plans-ready");
                              } else if (data.type === 'error') {
                                throw new Error(data.error);
                              }
                            }
                          }
                        }
                      } catch (error) {
                        console.error('Error continuing analysis:', error);
                        setIsLoading(false);
                        alert(`Failed to continue analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        setWorkflowStep("clarifying");
                      }
                    }}>
                      {/* Show only current question */}
                      {(() => {
                        const q = parsedQuestions[currentQuestionIndex];
                        return (
                          <div className="flex flex-col" style={{ maxHeight: "calc(100vh - 250px)" }}>
                            <div className="bg-white p-6 border-2 border-gray-400 flex-1 overflow-y-auto" style={{ fontFamily: fonts.mono, boxShadow: "2px 2px 0 #000000" }}>
                              <p className="text-base font-bold mb-4">{q.question}</p>

                              <div className="space-y-2">
                                {q.options.map((option, oIdx) => (
                                  <label
                                    key={oIdx}
                                    className="flex items-center p-3 border border-gray-300 cursor-pointer hover:bg-gray-50"
                                    style={{ fontFamily: fonts.mono }}
                                  >
                                    <input
                                      type="radio"
                                      name={`question-${currentQuestionIndex}`}
                                      value={option}
                                      checked={q.selected === option}
                                      onChange={() => {
                                        const updated = [...parsedQuestions];
                                        updated[currentQuestionIndex].selected = option;
                                        setParsedQuestions(updated);
                                      }}
                                      className="mr-3"
                                    />
                                    <span className="text-sm">{option}</span>
                                  </label>
                                ))}
                              </div>

                              {q.additionalInfo && (
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-xs" style={{ fontFamily: fonts.mono }}>
                                  <span dangerouslySetInnerHTML={{ __html: q.additionalInfo.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>') }} />
                                </div>
                              )}
                            </div>

                            <div className="flex gap-3 mt-6 flex-shrink-0">
                              {currentQuestionIndex > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                                  className="px-6 py-3 text-base bg-gray-400 text-black border-2 border-gray-500 cursor-pointer hover:bg-gray-500"
                                  style={{
                                    fontFamily: fonts.mono,
                                    boxShadow: "2px 2px 0 #000000",
                                  }}
                                >
                                  ← Previous
                                </button>
                              )}
                              <button
                                type="submit"
                                className="flex-1 px-6 py-3 text-base bg-blue-600 text-white border-2 border-blue-700 cursor-pointer hover:bg-blue-700"
                                style={{
                                  fontFamily: fonts.mono,
                                  boxShadow: "2px 2px 0 #000000",
                                }}
                              >
                                {currentQuestionIndex < parsedQuestions.length - 1 ? 'Next →' : 'Submit Answers →'}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </form>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white p-4 border-2 border-gray-400" style={{ fontFamily: fonts.mono }}>
                      <p className="text-sm whitespace-pre-wrap">{clarifyingQuestions}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plans Ready Step */}
          {workflowStep === "plans-ready" && (
            <PlansReadyScreen
              plans={plans}
              selectedIntegration={selectedIntegration}
              selectedFolder={selectedFolder}
              onOpenPlan={(plan, event) => {
                const target = event.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();

                const windowWidth = 500;
                const offset = 100; // Move window up by 100px from the card's top

                // Position window slightly above and centered on the clicked card
                const windowPosition = {
                  x: rect.left + (rect.width / 2) - (windowWidth / 2), // Center horizontally on card
                  y: rect.top - offset // Position window's top edge above the card
                };

                if (!openPlanWindows.find(w => w.plan.id === plan.id)) {
                  setOpenPlanWindows([...openPlanWindows, { plan, position: windowPosition }]);
                  setTopWindowId(plan.id);
                } else {
                  setTopWindowId(plan.id);
                }
              }}
              onGenerateFullPlan={handleGenerateFullPlan}
              generatingPlanIds={generatingPlanIds}
            />
          )}

        </div>
      </Window>

      {/* Plan Detail Windows */}
      {openPlanWindows.map((window, idx) => {
        // Get the latest plan from state, not the stale one from window
        const currentPlan = plans.find(p => p.id === window.plan.id);
        if (!currentPlan) return null;

        const planNumber = plans.findIndex(p => p.id === window.plan.id) + 1;
        const isGenerating = generatingPlanIds.includes(window.plan.id);
        const progressMessages = planProgressMessages[window.plan.id] || [];
        return (
          <PlanDetailWindow
            key={window.plan.id}
            plan={currentPlan}
            planNumber={planNumber}
            initialPosition={window.position}
            onClose={() => {
              setOpenPlanWindows(openPlanWindows.filter(w => w.plan.id !== window.plan.id));
            }}
            zIndex={1000 + (topWindowId === window.plan.id ? 100 : idx)}
            onFocus={() => setTopWindowId(window.plan.id)}
            isGenerating={isGenerating}
            progressMessages={progressMessages}
            onShowNextSteps={() => setNextStepsWindowPlan(currentPlan)}
          />
        );
      })}

      {/* Next Steps Window */}
      {nextStepsWindowPlan && (
        <NextStepsWindow
          planTitle={nextStepsWindowPlan.title}
          nextSteps={nextStepsWindowPlan.sections.nextSteps}
          onClose={() => setNextStepsWindowPlan(null)}
          zIndex={2000}
        />
      )}

      {/* Sessions Window */}
      {showSessionsWindow && (
        <SessionsWindow
          onClose={() => setShowSessionsWindow(false)}
          onSessionSelect={handleSessionSelect}
          zIndex={3000}
        />
      )}

      {/* GitHub Connect Window */}
      {showGitHubConnect && (
        <GitHubConnectWindow
          onClose={() => setShowGitHubConnect(false)}
          onRefresh={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const response = await fetch('/api/github-repositories', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
              });
              if (response.ok) {
                const data = await response.json();
                if (data.installations && data.installations.length > 0) {
                  setHasGitHubRepo(true);
                  setShowGitHubConnect(false);
                }
              }
            }
          }}
          zIndex={3000}
        />
      )}

      {/* Settings Window */}
      {showSettingsWindow && (
        <SettingsWindow
          onClose={() => setShowSettingsWindow(false)}
          zIndex={3000}
          currentBackground={backgroundPattern}
          onBackgroundChange={(bg) => {
            setBackgroundPattern(bg);
            if (typeof window !== 'undefined') {
              localStorage.setItem('backgroundPattern', bg);
            }
          }}
          useSandbox={useSandbox}
          onSandboxModeChange={(value) => {
            setUseSandbox(value);
            if (typeof window !== 'undefined') {
              localStorage.setItem('useSandbox', value.toString());
            }
          }}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showInsufficientCreditsModal}
        onClose={() => setShowInsufficientCreditsModal(false)}
        reason={upgradeReason}
        creditsInfo={creditsInfo}
      />
    </>
  );
}
