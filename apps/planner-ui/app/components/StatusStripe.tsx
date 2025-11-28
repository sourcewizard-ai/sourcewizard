import { useRouter } from "next/navigation";
import Hourglass from "./Hourglass";

type StepType = "loading" | "integration-select" | "analyzing" | "clarifying" | "generating" | "plans-ready" | "complete";

interface StatusStripeProps {
  currentStep: StepType;
  questionProgress?: string;
  onReset?: () => void;
}

interface StepConfig {
  icon: React.ReactNode;
  label: string | ((questionProgress?: string) => string);
}

const stepConfigs: Record<StepType, StepConfig> = {
  loading: {
    icon: <Hourglass size={16} />,
    label: "Loading..."
  },
  "integration-select": {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="6" y="1" width="4" height="1" fill="#000000" />
        <rect x="4" y="2" width="2" height="1" fill="#000000" />
        <rect x="6" y="2" width="4" height="1" fill="#d0d0d0" />
        <rect x="10" y="2" width="2" height="1" fill="#000000" />
        <rect x="3" y="3" width="1" height="1" fill="#000000" />
        <rect x="4" y="3" width="8" height="1" fill="#d8d8e8" />
        <rect x="12" y="3" width="1" height="1" fill="#000000" />
        <rect x="2" y="4" width="1" height="1" fill="#000000" />
        <rect x="3" y="4" width="10" height="1" fill="#e0e0f0" />
        <rect x="13" y="4" width="1" height="1" fill="#000000" />
        <rect x="2" y="5" width="1" height="1" fill="#000000" />
        <rect x="3" y="5" width="2" height="1" fill="#e8e8f8" />
        <rect x="5" y="5" width="3" height="1" fill="#c0e8f0" />
        <rect x="8" y="5" width="3" height="1" fill="#f0c0e8" />
        <rect x="11" y="5" width="2" height="1" fill="#f0f0c0" />
        <rect x="13" y="5" width="1" height="1" fill="#000000" />
        <rect x="1" y="6" width="1" height="1" fill="#000000" />
        <rect x="2" y="6" width="3" height="1" fill="#e8f0f0" />
        <rect x="5" y="6" width="3" height="1" fill="#b8e0f8" />
        <rect x="8" y="6" width="3" height="1" fill="#f8b8e0" />
        <rect x="11" y="6" width="3" height="1" fill="#f8e0d0" />
        <rect x="14" y="6" width="1" height="1" fill="#000000" />
        <rect x="1" y="7" width="1" height="1" fill="#000000" />
        <rect x="2" y="7" width="3" height="1" fill="#d0f0e0" />
        <rect x="5" y="7" width="3" height="1" fill="#e0d0f8" />
        <rect x="8" y="7" width="3" height="1" fill="#f0d0f0" />
        <rect x="11" y="7" width="3" height="1" fill="#f0f0d0" />
        <rect x="14" y="7" width="1" height="1" fill="#000000" />
        <rect x="1" y="8" width="1" height="1" fill="#000000" />
        <rect x="2" y="8" width="3" height="1" fill="#d0f8e0" />
        <rect x="5" y="8" width="3" height="1" fill="#e0d0f8" />
        <rect x="8" y="8" width="3" height="1" fill="#f8d0e0" />
        <rect x="11" y="8" width="3" height="1" fill="#f8f0d0" />
        <rect x="14" y="8" width="1" height="1" fill="#000000" />
        <rect x="1" y="9" width="1" height="1" fill="#000000" />
        <rect x="2" y="9" width="3" height="1" fill="#d8d8f0" />
        <rect x="5" y="9" width="3" height="1" fill="#e8d8f0" />
        <rect x="8" y="9" width="3" height="1" fill="#f0d8f0" />
        <rect x="11" y="9" width="3" height="1" fill="#d8f0d8" />
        <rect x="14" y="9" width="1" height="1" fill="#000000" />
        <rect x="2" y="10" width="1" height="1" fill="#000000" />
        <rect x="3" y="10" width="10" height="1" fill="#e0e0f0" />
        <rect x="13" y="10" width="1" height="1" fill="#000000" />
        <rect x="2" y="11" width="1" height="1" fill="#000000" />
        <rect x="3" y="11" width="10" height="1" fill="#d8d8e0" />
        <rect x="13" y="11" width="1" height="1" fill="#000000" />
        <rect x="3" y="12" width="1" height="1" fill="#000000" />
        <rect x="4" y="12" width="8" height="1" fill="#d0d0d8" />
        <rect x="12" y="12" width="1" height="1" fill="#000000" />
        <rect x="4" y="13" width="2" height="1" fill="#000000" />
        <rect x="6" y="13" width="4" height="1" fill="#c8c8d0" />
        <rect x="10" y="13" width="2" height="1" fill="#000000" />
        <rect x="6" y="14" width="4" height="1" fill="#000000" />
        <rect x="6" y="6" width="4" height="1" fill="#ffffff" />
        <rect x="5" y="7" width="6" height="2" fill="#f5f5f5" />
        <rect x="6" y="9" width="4" height="1" fill="#ffffff" />
        <rect x="7" y="7" width="2" height="2" fill="#808080" />
      </svg>
    ),
    label: "Welcome"
  },
  analyzing: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" fill="#000000" stroke="black" strokeWidth="1" />
        <text x="8" y="11" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="bold" fill="#00ff00">&gt;_</text>
      </svg>
    ),
    label: "Analyzing"
  },
  clarifying: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="6" y="2" width="4" height="1" fill="#000000" />
        <rect x="5" y="3" width="1" height="1" fill="#000000" />
        <rect x="6" y="3" width="4" height="1" fill="#0088ff" />
        <rect x="10" y="3" width="1" height="1" fill="#000000" />
        <rect x="4" y="4" width="1" height="1" fill="#000000" />
        <rect x="5" y="4" width="6" height="1" fill="#0088ff" />
        <rect x="11" y="4" width="1" height="1" fill="#000000" />
        <rect x="3" y="5" width="1" height="1" fill="#000000" />
        <rect x="4" y="5" width="8" height="1" fill="#0088ff" />
        <rect x="7" y="5" width="2" height="1" fill="#ffffff" />
        <rect x="12" y="5" width="1" height="1" fill="#000000" />
        <rect x="2" y="6" width="1" height="1" fill="#000000" />
        <rect x="3" y="6" width="10" height="1" fill="#0088ff" />
        <rect x="7" y="6" width="2" height="1" fill="#ffffff" />
        <rect x="13" y="6" width="1" height="1" fill="#000000" />
        <rect x="2" y="7" width="1" height="1" fill="#000000" />
        <rect x="3" y="7" width="10" height="1" fill="#0088ff" />
        <rect x="13" y="7" width="1" height="1" fill="#000000" />
        <rect x="2" y="8" width="1" height="1" fill="#000000" />
        <rect x="3" y="8" width="10" height="1" fill="#0088ff" />
        <rect x="7" y="8" width="2" height="1" fill="#ffffff" />
        <rect x="13" y="8" width="1" height="1" fill="#000000" />
        <rect x="2" y="9" width="1" height="1" fill="#000000" />
        <rect x="3" y="9" width="10" height="1" fill="#0088ff" />
        <rect x="7" y="9" width="2" height="1" fill="#ffffff" />
        <rect x="13" y="9" width="1" height="1" fill="#000000" />
        <rect x="2" y="10" width="1" height="1" fill="#000000" />
        <rect x="3" y="10" width="10" height="1" fill="#0088ff" />
        <rect x="7" y="10" width="2" height="1" fill="#ffffff" />
        <rect x="13" y="10" width="1" height="1" fill="#000000" />
        <rect x="3" y="11" width="1" height="1" fill="#000000" />
        <rect x="4" y="11" width="8" height="1" fill="#0088ff" />
        <rect x="7" y="11" width="2" height="1" fill="#ffffff" />
        <rect x="12" y="11" width="1" height="1" fill="#000000" />
        <rect x="4" y="12" width="1" height="1" fill="#000000" />
        <rect x="5" y="12" width="6" height="1" fill="#0088ff" />
        <rect x="11" y="12" width="1" height="1" fill="#000000" />
        <rect x="5" y="13" width="1" height="1" fill="#000000" />
        <rect x="6" y="13" width="4" height="1" fill="#0088ff" />
        <rect x="10" y="13" width="1" height="1" fill="#000000" />
        <rect x="6" y="14" width="4" height="1" fill="#000000" />
      </svg>
    ),
    label: (questionProgress) => questionProgress ? `Setup - ${questionProgress}` : "Setup"
  },
  generating: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" fill="#000000" stroke="black" strokeWidth="1" />
        <text x="8" y="11" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="bold" fill="#00ff00">&gt;_</text>
      </svg>
    ),
    label: "Generating"
  },
  "plans-ready": {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" fill="white" stroke="black" strokeWidth="1" />
        <polyline points="4,8 6.5,10.5 12,5" fill="none" stroke="#008000" strokeWidth="1.5" />
      </svg>
    ),
    label: "Ready"
  },
  complete: {
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="2" width="12" height="12" fill="#00ff00" stroke="black" strokeWidth="1.5" />
        <rect x="4" y="4" width="8" height="8" fill="#ffff00" stroke="black" strokeWidth="1" />
        <polyline points="5,8 7,10 11,6" fill="none" stroke="black" strokeWidth="1.5" />
      </svg>
    ),
    label: "Complete"
  }
};

export default function StatusStripe({ currentStep, questionProgress, onReset }: StatusStripeProps) {
  const config = stepConfigs[currentStep];
  const labelText = typeof config.label === "function" ? config.label(questionProgress) : config.label;

  return (
    <div className="px-3 py-2 flex items-center justify-between gap-2" style={{ backgroundColor: "#e8ecf9", borderBottom: "2px solid #b8c0e0" }}>
      <div className="flex gap-2" style={{ alignItems: "center", display: "flex" }}>
        <div style={{ transform: "scale(1.5)", transformOrigin: "center", marginLeft: "8px", display: "flex", alignItems: "center", height: "24px" }}>
          {config.icon}
        </div>
        <span className="text-sm text-black" style={{ fontFamily: "var(--font-90s)", fontSize: "24px", lineHeight: "24px", display: "inline-block" }}>
          {labelText}
        </span>
        {currentStep === "plans-ready" && (
          <span className="text-xs text-gray-700 ml-2" style={{ fontFamily: "system-ui, sans-serif" }}>
            Plans are ready to be executed with a coding agent as they finish generating
          </span>
        )}
      </div>

      {currentStep === "plans-ready" && onReset && (
        <button
          onClick={onReset}
          className="px-3 py-1 text-xs bg-gray-400 text-black border border-gray-600 cursor-pointer hover:bg-gray-500"
          style={{
            fontFamily: "monospace",
            boxShadow: "1px 1px 0 #000000",
          }}
        >
          [ Try Different Integration ]
        </button>
      )}
    </div>
  );
}
