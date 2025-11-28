import { fonts } from "../../lib/fonts";

interface StatusBarProps {
  currentStep: "loading" | "integration-select" | "analyzing" | "clarifying" | "generating" | "plans-ready" | "complete";
}

export default function StatusBar({ currentStep }: StatusBarProps) {
  const getStaticButtonStyle = (isActive: boolean = false) => {
    return {
      backgroundColor: !isActive ? "#c0c0c0" : "#d0d0d0",
      border: "2px solid #000000",
      boxShadow: !isActive ? "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #808080" : "inset -1px -1px 0 #ffffff, inset 1px 1px 0 #808080",
      color: "#000000",
      fontFamily: fonts.mono,
      fontSize: "11px",
      textDecoration: "none",
      display: "inline-flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: "0.25rem",
    };
  };

  const stages = [
    { id: "integration-select", label: "Welcome", icon: "📝" },
    { id: "analyzing", label: "Analyzing", icon: "🔍" },
    { id: "clarifying", label: "Setup", icon: "❓" },
    { id: "generating", label: "Generating", icon: "⚙️" },
    { id: "plans-ready", label: "Ready", icon: "✅" },
  ];

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bg-gray-300 flex gap-0"
      style={{
        top: "46px", // Just below the taskbar with minimal gap
        zIndex: 19,
        border: "2px solid #808080",
        boxShadow: "2px 2px 0 #000000",
      }}
    >
      {stages.map((stage) => (
        <div
          key={stage.id}
          className="px-3 py-2 select-none whitespace-nowrap"
          style={getStaticButtonStyle(currentStep === stage.id)}
        >
          <span>{stage.icon}</span>
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  );
}
