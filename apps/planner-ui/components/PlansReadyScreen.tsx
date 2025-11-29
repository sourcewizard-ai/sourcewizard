import { useState } from 'react';
import { fonts } from "../lib/fonts";

interface IntegrationPlan {
  id: number;
  title: string;
  description: string;
  steps?: string[];
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

interface PlansReadyScreenProps {
  plans: IntegrationPlan[];
  selectedIntegration: string;
  selectedFolder: string;
  onOpenPlan: (plan: IntegrationPlan, event: React.MouseEvent) => void;
  onGenerateFullPlan?: (planId: number) => void;
  generatingPlanIds?: number[];
}

export default function PlansReadyScreen({
  plans,
  selectedIntegration,
  selectedFolder,
  onOpenPlan,
  onGenerateFullPlan,
  generatingPlanIds = [],
}: PlansReadyScreenProps) {

  const difficultyColors = {
    Easy: "bg-green-100 border-green-400 text-green-800",
    Medium: "bg-yellow-100 border-yellow-400 text-yellow-800",
    Hard: "bg-red-100 border-red-400 text-red-800",
  };

  // Check if a plan has sections (is a full plan)
  const isFullPlan = (plan: IntegrationPlan) => {
    return plan.sections.setup.length > 0 ||
      plan.sections.integration.length > 0 ||
      plan.sections.verification.length > 0 ||
      plan.sections.nextSteps.length > 0;
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        {plans.map((plan, idx) => {
          const isFull = isFullPlan(plan);
          const isGenerating = generatingPlanIds.includes(plan.id);

          return (
            <div
              key={plan.id}
              className="bg-white border-2 border-gray-400 transition-colors"
              style={{
                fontFamily: fonts.mono,
                boxShadow: "4px 4px 0 #000000",
              }}
            >
              <div className="p-4 border-b-2 border-gray-400 bg-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold">Plan {idx + 1}</span>
                  <span
                    className={`px-2 py-1 text-xs font-bold border ${difficultyColors[plan.difficulty]}`}
                    style={{ boxShadow: "1px 1px 0 #000000" }}
                  >
                    {plan.difficulty}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-800">{plan.title}</h3>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-700 mb-3">{plan.description}</p>
                <div className="text-xs text-gray-600 mb-3">
                  <span className="font-bold">Est. Time:</span> {plan.estimatedTime}
                </div>

                {isFull ? (
                  <button
                    className="w-full px-3 py-2 text-xs font-bold bg-blue-500 text-white border-2 border-black hover:bg-blue-600 transition-colors"
                    style={{ boxShadow: "2px 2px 0 #000000" }}
                    onClick={(e) => onOpenPlan(plan, e)}
                  >
                    Click to view details →
                  </button>
                ) : isGenerating ? (
                  <button
                    className="w-full px-3 py-2 text-xs font-bold bg-yellow-500 text-white border-2 border-black hover:bg-yellow-600 transition-colors"
                    style={{ boxShadow: "2px 2px 0 #000000" }}
                    onClick={(e) => onOpenPlan(plan, e)}
                  >
                    Generating... (click to view progress)
                  </button>
                ) : (
                  <button
                    className="w-full px-3 py-2 text-xs font-bold bg-green-500 text-white border-2 border-black hover:bg-green-600 transition-colors"
                    style={{ boxShadow: "2px 2px 0 #000000" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onGenerateFullPlan?.(plan.id);
                    }}
                  >
                    Generate Full Plan →
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Placeholder cards for generating plans */}
        {[...Array(Math.max(0, 3 - plans.length))].map((_, idx) => (
          <div
            key={`placeholder-${idx}`}
            className="bg-gray-100 border-2 border-gray-300"
            style={{
              fontFamily: fonts.mono,
              boxShadow: "4px 4px 0 #000000",
            }}
          >
            <div className="p-4 border-b-2 border-gray-300 bg-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-gray-500">Plan {plans.length + idx + 1}</span>
                <span className="px-2 py-1 text-xs font-bold border border-gray-400 bg-gray-200 text-gray-500">
                  Generating...
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-500">Generating plan outline...</h3>
            </div>
            <div className="p-4">
              <div className="h-12 bg-gray-200 animate-pulse mb-3"></div>
              <div className="h-4 bg-gray-200 animate-pulse w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
