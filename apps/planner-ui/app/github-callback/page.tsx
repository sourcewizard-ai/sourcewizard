"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fonts } from "../../lib/fonts";

function AuthGitHubCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing GitHub installation...");

  useEffect(() => {
    async function handleGitHubCallback() {
      try {
        const code = searchParams.get('code');
        const installationId = searchParams.get('installation_id');
        const setupAction = searchParams.get('setup_action');

        if (!code || !installationId) {
          throw new Error('Missing code or installation_id');
        }

        if (setupAction !== 'install') {
          throw new Error('Installation was not completed');
        }

        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        setMessage('Fetching repositories from GitHub...');

        // Exchange code for installation repositories
        const response = await fetch('/api/github-installation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            code,
            installation_id: installationId,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch repositories: ${errorText}`);
        }

        const data = await response.json();

        setStatus('success');
        setMessage(`Successfully installed GitHub app! Redirecting...`);

        // Redirect to home
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);

      } catch (error: any) {
        console.error('GitHub callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect GitHub repository');

        // Redirect to home after showing error
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    }

    handleGitHubCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-5">
      <div
        className="bg-gray-300 text-black w-full max-w-md"
        style={{
          fontFamily: fonts.mono,
          boxShadow: "3px 3px 0 #000000",
          border: "1px solid #808080",
        }}
      >
        {/* Title Bar */}
        <div
          className="bg-gray-300 text-black border-b border-gray-500 px-4 py-2 flex items-center justify-between"
          style={{ fontFamily: fonts.mono }}
        >
          <span className="text-sm font-bold">GitHub Connection</span>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold mb-2">
              {status === "loading" && "Processing..."}
              {status === "success" && "Success!"}
              {status === "error" && "Error"}
            </h2>
          </div>

          <div
            className={`p-4 mb-4 text-sm ${status === "error"
                ? "bg-red-200 text-red-800"
                : "bg-gray-200 text-black"
              }`}
            style={{
              fontFamily: fonts.mono,
              border: "1px solid #808080",
            }}
          >
            {message}
          </div>

          {status === "success" && (
            <p className="text-sm text-center">
              Redirecting...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthGitHubCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center p-5">
        <div
          className="bg-gray-300 text-black w-full max-w-md"
          style={{
            fontFamily: fonts.mono,
            boxShadow: "3px 3px 0 #000000",
            border: "1px solid #808080",
          }}
        >
          <div className="bg-gray-300 text-black border-b border-gray-500 px-4 py-2">
            <span className="text-sm font-bold">GitHub Connection</span>
          </div>
          <div className="p-6 text-center">
            <p className="text-sm">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <AuthGitHubCallbackContent />
    </Suspense>
  );
}
