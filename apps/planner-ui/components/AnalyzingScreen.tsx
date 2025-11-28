import { useEffect, useRef, useState } from "react";
import { fonts } from "../lib/fonts";
import Hourglass from "../app/components/Hourglass";
import ProgressBar from "./ProgressBar";

interface AnalyzingScreenProps {
  selectedFolder: string;
  selectedIntegration: string;
  progressMessages: string[];
  streamStatus: 'active' | 'thinking' | 'closed';
  isGeneratingOutput: boolean;
}

export default function AnalyzingScreen({
  selectedFolder,
  selectedIntegration,
  progressMessages,
  streamStatus,
  isGeneratingOutput,
}: AnalyzingScreenProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressMessages]);

  // Continuous slow animation of progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0; // Loop back
        return prev + 0.5; // Slow increment
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: fonts.mono }}>
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4">
        <div className="flex items-center gap-3">
          <Hourglass size={24} />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {isGeneratingOutput ? "Generating Integration Plans..." : "Agent Progress:"}
            </p>
            <p className="text-xs text-gray-600">
              Analyzing {selectedFolder} for {selectedIntegration} integration
            </p>
          </div>
        </div>

        {/* Progress Bar with Segments */}
        <div className="mt-3">
          <ProgressBar progress={progress} />
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div className="px-4 py-2">
        <div
          className="overflow-y-auto space-y-2 p-2 border border-gray-400 bg-gray-50"
          style={{ height: "300px", fontFamily: "monospace", boxShadow: "3px 3px 0 #000000" }}
        >
          {progressMessages.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Waiting for agent to start...</p>
          ) : (
            progressMessages.map((msg, idx) => (
              <p key={idx} className="text-xs text-gray-700">
                {msg}
              </p>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Status Footer */}
      <div className="flex-shrink-0 p-4">
        <p className="text-xs text-gray-600">
          {streamStatus === 'active' && 'Active - Receiving messages'}
          {streamStatus === 'thinking' && 'Agent thinking...'}
          {streamStatus === 'closed' && 'Stream closed - Generating output'}
        </p>
        {isGeneratingOutput && (
          <p className="text-xs text-blue-700 font-bold mt-1">
            Analysis complete. Generating structured output...
          </p>
        )}
      </div>
    </div>
  );
}
