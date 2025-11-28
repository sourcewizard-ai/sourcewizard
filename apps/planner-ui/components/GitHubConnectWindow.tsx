import { useState, useRef, useEffect } from 'react';
import { fonts } from '../lib/fonts';
import DraggableWindow from './DraggableWindow';

interface GitHubConnectWindowProps {
  onClose: () => void;
  onRefresh: () => void;
  zIndex: number;
}

export default function GitHubConnectWindow({
  onClose,
  onRefresh,
  zIndex,
}: GitHubConnectWindowProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for GitHub App installation
  useEffect(() => {
    const checkInstallation = async () => {
      setIsChecking(true);
      setCheckMessage('Checking for GitHub App installation...');

      try {
        await onRefresh();
        // If onRefresh closes the window, we're done
      } catch (error) {
        console.error('Error checking installation:', error);
      } finally {
        setIsChecking(false);
        setCheckMessage('');
      }
    };

    // Start polling when user clicks Install button (we detect by listening to window focus)
    const handleFocus = () => {
      // Check immediately when window regains focus
      checkInstallation();

      // Start polling every 3 seconds
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(checkInstallation, 3000);
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [onRefresh]);

  return (
    <DraggableWindow
      title="Connect GitHub Repository"
      onClose={onClose}
      zIndex={zIndex}
      initialWidth={500}
      initialHeight={350}
      initialX={window.innerWidth / 2 - 250}
      initialY={window.innerHeight / 2 - 175}
      resizable={false}
    >

      {/* Content */}
      <div className="p-6" style={{ fontFamily: fonts.mono }}>
        <p className="mb-4">
          To use the planner, you need to connect a GitHub repository.
        </p>
        <p className="mb-6">
          Click the button below to install the SourceWizard GitHub App and select a repository.
        </p>

        {/* Status Message */}
        {isChecking && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-300 text-blue-800 text-sm">
            {checkMessage}
          </div>
        )}
        <button
          onClick={() => {
            window.location.href = 'https://github.com/apps/sourcewizard-ai/installations/select_target';
          }}
          className="w-full px-4 py-2 mb-3 bg-gray-800 text-white font-bold border border-gray-900 hover:bg-gray-700 transition-colors cursor-pointer"
          style={{
            fontFamily: fonts.mono,
            boxShadow: '2px 2px 0 #000000',
          }}
        >
          [ Install GitHub App ]
        </button>
        <button
          onClick={onRefresh}
          className="w-full px-4 py-2 bg-gray-400 text-black font-bold border border-gray-600 hover:bg-gray-500 transition-colors cursor-pointer"
          style={{
            fontFamily: fonts.mono,
            boxShadow: '2px 2px 0 #000000',
          }}
        >
          [ I Already Installed - Refresh ]
        </button>
      </div>
    </DraggableWindow>
  );
}
