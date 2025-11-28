import { useState, useMemo } from 'react';
import { fonts } from '../lib/fonts';
import PlanSection from './PlanSection';
import DraggableWindow from './DraggableWindow';
import AnalyzingScreen from './AnalyzingScreen';

// Utility function to remove emojis from text
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

interface IntegrationPlan {
  id: number;
  title: string;
  description: string;
  sections: {
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

interface PlanDetailWindowProps {
  plan: IntegrationPlan;
  planNumber: number;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
  initialPosition?: { x: number; y: number };
  onShowNextSteps?: () => void;
  isGenerating?: boolean;
  progressMessages?: string[];
}

export default function PlanDetailWindow({
  plan,
  planNumber,
  onClose,
  zIndex,
  onFocus,
  initialPosition,
  onShowNextSteps,
  isGenerating = false,
  progressMessages = [],
}: PlanDetailWindowProps) {
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  // Strip emojis from progress messages
  const cleanProgressMessages = useMemo(
    () => progressMessages.map(stripEmojis),
    [progressMessages]
  );

  // Check if plan has any sections
  const hasSections = plan.sections.setup.length > 0 ||
                      plan.sections.integration.length > 0 ||
                      plan.sections.verification.length > 0 ||
                      plan.sections.nextSteps.length > 0;

  return (
    <DraggableWindow
      title={`Plan ${planNumber}: ${plan.title}`}
      onClose={onClose}
      zIndex={zIndex}
      onFocus={onFocus}
      initialWidth={500}
      initialHeight={600}
      initialX={initialPosition?.x ?? 100 + planNumber * 30}
      initialY={initialPosition?.y ?? 50 + planNumber * 30}
      resizable={true}
    >

      {/* Header with metadata */}
      <div className="p-4 border-b border-gray-400 flex-shrink-0 bg-gray-100">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {plan.description && (
              <p className="text-xs text-gray-700 mb-2">
                {plan.description}
              </p>
            )}
            <div className="flex gap-4 text-xs">
              <span>
                <span className="font-bold">Difficulty:</span> {plan.difficulty}
              </span>
              <span>
                <span className="font-bold">Est. Time:</span> {plan.estimatedTime}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end ml-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => {
                  let markdown = `# ${plan.title}\n\n`;
                  markdown += `**Difficulty:** ${plan.difficulty}\n`;
                  markdown += `**Estimated Time:** ${plan.estimatedTime}\n\n`;

                  markdown += `## Setup\n\n${plan.sections.setup.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}\n\n`;
                  markdown += `## Integration\n\n${plan.sections.integration.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}\n\n`;
                  markdown += `## Verification\n\n${plan.sections.verification.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}`;

                  navigator.clipboard.writeText(markdown);

                  // Show copied message
                  setShowCopiedMessage(true);
                  setTimeout(() => setShowCopiedMessage(false), 2000);

                  // Show next steps window
                  if (onShowNextSteps) {
                    onShowNextSteps();
                  }
                }}
                className="px-3 py-1 text-xs bg-gray-600 text-white border border-gray-700 cursor-pointer hover:bg-gray-700 whitespace-nowrap"
                style={{
                  fontFamily: fonts.mono,
                  boxShadow: "1px 1px 0 #000000",
                }}
                title="Copy plan as markdown"
              >
                [ Copy as Markdown ]
              </button>
              {showCopiedMessage && (
                <div
                  className="absolute top-full mt-2 right-0 px-3 py-2 bg-green-600 text-white text-xs font-bold whitespace-nowrap"
                  style={{
                    fontFamily: fonts.mono,
                    boxShadow: "2px 2px 0 #000000",
                    border: "1px solid #166534",
                  }}
                >
                  ✓ Copied to clipboard!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content: Plan Sections or Generating State */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {isGenerating || !hasSections ? (
          <AnalyzingScreen
            selectedFolder={plan.title}
            selectedIntegration={`${plan.difficulty} Plan`}
            progressMessages={cleanProgressMessages}
            streamStatus="active"
            isGeneratingOutput={false}
          />
        ) : (
          <div className="p-4 text-xs space-y-4">
            <PlanSection
              title="Setup"
              icon=""
              color="blue"
              steps={plan.sections.setup}
              summary={plan.summaries.setup}
            />
            <PlanSection
              title="Integration"
              icon=""
              color="blue"
              steps={plan.sections.integration}
              summary={plan.summaries.integration}
            />
            <PlanSection
              title="Verification"
              icon=""
              color="blue"
              steps={plan.sections.verification}
              summary={plan.summaries.verification}
            />
            <PlanSection
              title="Next Steps"
              icon=""
              color="blue"
              steps={plan.sections.nextSteps}
              summary={plan.summaries.nextSteps}
              alwaysExpanded={true}
              note="These steps need to be completed manually by you."
            />
          </div>
        )}
      </div>

    </DraggableWindow>
  );
}
