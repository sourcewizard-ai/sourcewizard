"use client";

import { useState } from "react";
import RetroBackground from "./RetroBackground";
import Logo from "./Logo";
import TaskBar from "./TaskBar";
import StatusBar from "./StatusBar";
import Sidebar from "./Sidebar";
import StatusStripe from "./StatusStripe";
import DraggableWindow from "../../components/DraggableWindow";
import { useRouter } from "next/navigation";
import { fonts } from "../../lib/fonts";

interface WindowProps {
  children: React.ReactNode;
  title: string;
  loading?: boolean;
  currentStep?: "loading" | "integration-select" | "analyzing" | "clarifying" | "generating" | "plans-ready" | "complete";
  onMyPlansClick?: () => void;
  onSettingsClick?: () => void;
  backgroundPattern?: string;
  userEmail?: string | null;
  onReset?: () => void;
}

export default function Window({
  children,
  title,
  loading = false,
  currentStep = "loading",
  questionProgress,
  onMyPlansClick,
  onSettingsClick,
  backgroundPattern = 'grid',
  userEmail = null,
  onReset,
}: WindowProps & { questionProgress?: string }) {
  const router = useRouter();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pressedButtons, setPressedButtons] = useState<Set<string>>(new Set());
  const isExpanded = currentStep === "plans-ready" || currentStep === "complete";

  const windowWidth = isExpanded ? 1200 : 900;
  const windowHeight = isExpanded ? 650 : 600;

  const handleButtonPress = (buttonId: string) => {
    setPressedButtons((prev) => new Set(prev).add(buttonId));
  };

  const handleButtonRelease = (buttonId: string) => {
    setPressedButtons((prev) => {
      const newSet = new Set(prev);
      newSet.delete(buttonId);
      return newSet;
    });
  };

  const handleClose = () => {
    setShowCloseConfirm(true);
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    window.location.href = "/planner";
  };

  const cancelClose = () => {
    setShowCloseConfirm(false);
  };

  const windowTheme = {
    window: {
      className: "bg-gray-300 text-black",
      style: {
        fontFamily: fonts.mono,
        fontSize: "14px",
        boxShadow: "3px 3px 0 #000000",
        border: "1px solid #808080",
        borderBottom: "4px solid #404040",
      },
    },
    titleBar: {
      className: "bg-gray-300 text-black border-b border-gray-500",
      style: {
        fontFamily: fonts.mono,
      },
    },
    content: {
      className: "bg-gray-300 text-black",
      style: {
        fontFamily: fonts.mono,
      },
    },
    buttonArea: {
      className: "bg-gray-300 text-black border-t border-gray-500",
      style: {
        fontFamily: fonts.mono,
      },
    },
  };

  return (
    <div className="relative h-screen bg-black overflow-hidden flex">
      <RetroBackground pattern={backgroundPattern} />

      {/* Sidebar on the left, below logo */}
      <div className="absolute left-1 top-20 z-30">
        <Sidebar onMyPlansClick={onMyPlansClick} onSettingsClick={onSettingsClick} />
      </div>

      {/* Main content area */}
      <div className="flex-1 relative">
        {/* Logo behind window */}
        <Logo />

        {/* Floating TaskBar at the top */}
        <div className="relative" style={{ zIndex: 20 }}>
          <TaskBar initialActiveSection="planner" isFloating={true} userEmail={userEmail} />
        </div>

        {/* Floating window - centered and smaller */}
        <div
          className="relative z-10 w-full h-full flex items-center justify-center p-2 sm:p-8"
          style={{
            paddingTop: isExpanded ? '60px' : undefined,
          }}
        >
          <DraggableWindow
            title={title || "SourceWizard Planner Assistant"}
            onClose={handleClose}
            zIndex={10}
            initialWidth={900}
            initialHeight={600}
            width={windowWidth}
            height={windowHeight}
            resizable={true}
          >
            {/* Status Stripe */}
            <StatusStripe currentStep={currentStep} questionProgress={questionProgress} onReset={onReset} />

            {/* Window Content */}
            <div className="text-black flex-1 min-h-0 overflow-y-auto">
              {children}
            </div>
          </DraggableWindow>
        </div>

        {/* Close Confirmation Dialog */}
        {showCloseConfirm && (
          <div
            className="fixed inset-0 bg-transparent flex items-center justify-center"
            style={{ zIndex: 10000 }}
          >
            <div
              className={`window ${windowTheme.window.className} flex flex-col`}
              style={{
                ...windowTheme.window.style,
                width: "400px",
                height: "200px",
              }}
            >
              {/* Confirmation Title Bar */}
              <div
                className={`title-bar ${windowTheme.titleBar.className} pl-6 pr-2 py-2 flex items-center justify-between select-none`}
                style={{
                  ...windowTheme.titleBar.style,
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              >
                <div className="flex items-center">
                  <span className="text-sm font-bold text-black">
                    Exit Setup
                  </span>
                </div>
                <button
                  onClick={cancelClose}
                  className="bg-gray-300 text-black text-sm font-bold flex items-center justify-center cursor-pointer px-1 py-0.5"
                  style={{
                    fontFamily: fonts.mono,
                    border: "1px solid #808080",
                    boxShadow: pressedButtons.has("confirm-close")
                      ? "none"
                      : "1px 1px 0 #000000",
                    transform: pressedButtons.has("confirm-close")
                      ? "translate(1px, 1px)"
                      : "none",
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleButtonPress("confirm-close");
                  }}
                  onMouseUp={() => handleButtonRelease("confirm-close")}
                  onMouseLeave={() => handleButtonRelease("confirm-close")}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    handleButtonPress("confirm-close");
                  }}
                  onTouchEnd={() => handleButtonRelease("confirm-close")}
                  onTouchCancel={() => handleButtonRelease("confirm-close")}
                >
                  [X]
                </button>
              </div>

              {/* Confirmation Content */}
              <div
                className={`window-content ${windowTheme.content.className} overflow-hidden flex flex-col flex-1`}
              >
                <div className="flex-1 p-6 flex items-center justify-center">
                  <p
                    className="text-black text-center"
                    style={{ fontFamily: fonts.mono }}
                  >
                    Are you sure you want to exit?
                  </p>
                </div>

                {/* Confirmation Button Area */}
                <div
                  className={`${windowTheme.buttonArea.className} px-6 py-4 flex justify-end space-x-4`}
                  style={windowTheme.buttonArea.style}
                >
                  <button
                    onClick={confirmClose}
                    className="px-4 py-1 text-sm font-bold bg-gray-300 text-black cursor-pointer"
                    style={{
                      fontFamily: fonts.mono,
                      border: "1px solid #808080",
                      boxShadow: pressedButtons.has("yes")
                        ? "none"
                        : "1px 1px 0 #000000",
                      transform: pressedButtons.has("yes")
                        ? "translate(1px, 1px)"
                        : "none",
                    }}
                    onMouseDown={() => handleButtonPress("yes")}
                    onMouseUp={() => handleButtonRelease("yes")}
                    onMouseLeave={() => handleButtonRelease("yes")}
                    onTouchStart={() => handleButtonPress("yes")}
                    onTouchEnd={() => handleButtonRelease("yes")}
                    onTouchCancel={() => handleButtonRelease("yes")}
                  >
                    [ Yes ]
                  </button>
                  <button
                    onClick={cancelClose}
                    className="px-4 py-1 text-sm font-bold bg-gray-300 text-black cursor-pointer"
                    style={{
                      fontFamily: fonts.mono,
                      border: "1px solid #808080",
                      boxShadow: pressedButtons.has("cancel")
                        ? "none"
                        : "1px 1px 0 #000000",
                      transform: pressedButtons.has("cancel")
                        ? "translate(1px, 1px)"
                        : "none",
                    }}
                    onMouseDown={() => handleButtonPress("cancel")}
                    onMouseUp={() => handleButtonRelease("cancel")}
                    onMouseLeave={() => handleButtonRelease("cancel")}
                    onTouchStart={() => handleButtonPress("cancel")}
                    onTouchEnd={() => handleButtonRelease("cancel")}
                    onTouchCancel={() => handleButtonRelease("cancel")}
                  >
                    [ Cancel ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
