import { useState } from 'react';
import { fonts } from '../lib/fonts';
import DraggableWindow from './DraggableWindow';
import { backgroundPatterns } from '../app/components/RetroBackground';

interface SettingsWindowProps {
  onClose: () => void;
  zIndex: number;
  currentBackground: string;
  onBackgroundChange: (background: string) => void;
  useSandbox: boolean;
  onSandboxModeChange: (useSandbox: boolean) => void;
}

const backgrounds = [
  { id: 'grid', name: 'Grid', preview: 'Linear grid pattern' },
  { id: 'waves', name: 'Waves', preview: 'Wave pattern' },
  { id: 'solid', name: 'Solid', preview: 'Solid color' },
  { id: 'purple-haze', name: 'Purple Haze', preview: 'Purple gradient' },
  { id: 'cyber-pink', name: 'Cyber Pink', preview: 'Pink and purple' },
  { id: 'sunset', name: 'Sunset', preview: 'Orange to purple' },
  { id: 'matrix', name: 'Matrix', preview: 'Green on black' },
  { id: 'commodore-64', name: 'Commodore 64', preview: 'Classic C64 blue' },
  { id: 'teal-gradient', name: 'Teal', preview: 'Teal solid' },
  { id: 'lavender', name: 'Lavender', preview: 'Light purple' },
  { id: 'stripes', name: 'Stripes', preview: 'Horizontal stripes' },
  { id: 'cubes', name: 'Cubes', preview: '3D cube pattern' },
  { id: 'tiles', name: 'Tiles', preview: '3D tile squares' },
];

type SettingsSection = 'appearance' | 'general' | 'about';

export default function SettingsWindow({
  onClose,
  zIndex,
  currentBackground,
  onBackgroundChange,
  useSandbox: initialUseSandbox,
  onSandboxModeChange,
}: SettingsWindowProps) {
  const [selectedBackground, setSelectedBackground] = useState(currentBackground);
  const [useSandbox, setUseSandbox] = useState(initialUseSandbox);
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [showAuthors, setShowAuthors] = useState(false);

  const handleApply = () => {
    onBackgroundChange(selectedBackground);
    onSandboxModeChange(useSandbox);
  };

  return (
    <DraggableWindow
      title="Settings"
      onClose={onClose}
      zIndex={zIndex}
      initialWidth={700}
      initialHeight={600}
      resizable={false}
    >
      <div className="flex h-full">
        {/* Sidebar - narrower on mobile */}
        <div className="w-24 sm:w-40 border-r-2 border-gray-400 bg-gray-200 flex-shrink-0">
          <div className="flex flex-col p-1 sm:p-2 space-y-1">
            {[
              { id: 'general' as SettingsSection, label: 'General' },
              { id: 'appearance' as SettingsSection, label: 'Appearance' },
              { id: 'about' as SettingsSection, label: 'About' },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="text-left px-2 sm:px-3 py-2 text-xs sm:text-sm border-2 border-gray-400 cursor-pointer"
                style={{
                  fontFamily: fonts.mono,
                  backgroundColor: activeSection === section.id ? '#e0e0e0' : '#f5f5f5',
                  boxShadow: activeSection === section.id ? 'inset 1px 1px 0 #808080' : '1px 1px 0 #000000',
                }}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1">
          {activeSection === 'appearance' && (
            <>
              {/* Header */}
              <div className="p-3 sm:p-6 pb-2 sm:pb-3 flex-shrink-0">
                <h3 className="text-xs sm:text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                  Background Pattern
                </h3>
              </div>

              {/* Scrollable Background Grid */}
              <div className="flex-1 px-3 sm:px-6 overflow-y-auto min-h-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 pb-3">
                  {backgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className="flex flex-col items-center p-2 sm:p-3 border-2 border-gray-400 cursor-pointer hover:bg-gray-100"
                      style={{
                        fontFamily: fonts.mono,
                        backgroundColor: selectedBackground === bg.id ? '#e0e0e0' : '#f5f5f5',
                        boxShadow: selectedBackground === bg.id ? 'inset 1px 1px 0 #808080' : '1px 1px 0 #000000',
                      }}
                      onClick={() => setSelectedBackground(bg.id)}
                    >
                      <div
                        className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-black mb-1 sm:mb-2 flex-shrink-0"
                        style={{
                          ...backgroundPatterns[bg.id],
                          boxShadow: '2px 2px 0 #000000',
                        }}
                      />
                      <div className="text-center">
                        <div className="font-bold text-[10px] sm:text-xs">{bg.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSection === 'general' && (
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
              <h3 className="text-xs sm:text-sm font-bold mb-4" style={{ fontFamily: fonts.mono }}>
                General Settings
              </h3>

              <div className="space-y-6">
                {/* Sandbox Mode Setting - Only in development */}
                {process.env.NODE_ENV === "development" && (
                  <div>
                    <h4 className="text-sm font-bold mb-2" style={{ fontFamily: fonts.mono }}>
                      Execution Mode
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="executionMode"
                          value="local"
                          checked={!useSandbox}
                          onChange={() => setUseSandbox(false)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                            Local Path
                          </div>
                          <div className="text-xs text-gray-600" style={{ fontFamily: fonts.mono }}>
                            Run CLI from local file system path
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="executionMode"
                          value="sandbox"
                          checked={useSandbox}
                          onChange={() => setUseSandbox(true)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                            Vercel Sandbox
                          </div>
                          <div className="text-xs text-gray-600" style={{ fontFamily: fonts.mono }}>
                            Run CLI in isolated Vercel Sandbox environment (requires Git repository URL)
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Subscription Management */}
                <div>
                  <h4 className="text-sm font-bold mb-2" style={{ fontFamily: fonts.mono }}>
                    Subscription Management
                  </h4>
                  <p className="text-xs text-gray-600 mb-3" style={{ fontFamily: fonts.mono }}>
                    Manage your subscription, billing, and payment methods.
                  </p>
                  <a
                    href="https://billing.stripe.com/p/login/fZu8wP8wW6KngAu0V0cV200"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-2 text-xs bg-blue-600 text-white border-2 border-blue-700 cursor-pointer hover:bg-blue-700"
                    style={{
                      fontFamily: fonts.mono,
                      boxShadow: '2px 2px 0 #000000',
                    }}
                  >
                    [ Manage Subscription ]
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'about' && (
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto">
              <h3 className="text-xs sm:text-sm font-bold mb-4" style={{ fontFamily: fonts.mono }}>
                About
              </h3>
              <p className="text-sm mb-2" style={{ fontFamily: fonts.mono }}>
                SourceWizard Planner Assistant
              </p>
              <p
                className="text-xs text-gray-600"
                style={{ fontFamily: fonts.mono }}
                onClick={() => setShowAuthors(true)}
              >
                Version 1.0.0
              </p>
            </div>
          )}

          {/* Fixed Buttons */}
          <div className="p-3 sm:p-6 pt-3 sm:pt-4 border-t-2 border-gray-400 flex-shrink-0">
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={handleApply}
                className="flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 text-white border-2 border-blue-700 cursor-pointer hover:bg-blue-700"
                style={{
                  fontFamily: fonts.mono,
                  boxShadow: '2px 2px 0 #000000',
                }}
              >
                Apply
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-2 sm:px-4 py-2 text-xs sm:text-sm bg-gray-400 text-black border-2 border-gray-500 cursor-pointer hover:bg-gray-500"
                style={{
                  fontFamily: fonts.mono,
                  boxShadow: '2px 2px 0 #000000',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Authors Popup */}
      {showAuthors && (
        <DraggableWindow
          title="Authors"
          onClose={() => setShowAuthors(false)}
          zIndex={zIndex + 1}
          initialWidth={400}
          initialHeight={300}
          resizable={false}
          initialX={window.innerWidth / 2 - 200}
          initialY={window.innerHeight / 2 - 150}
        >
          <div className="p-6">
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: fonts.mono }}>
              Created by
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                  Ivan Chebykin
                </p>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                  Lukas Korganas
                </p>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: fonts.mono }}>
                  Claude
                </p>
              </div>
            </div>
          </div>
        </DraggableWindow>
      )}
    </DraggableWindow>
  );
}
