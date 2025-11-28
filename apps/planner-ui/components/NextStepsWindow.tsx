import { fonts } from '../lib/fonts';
import DraggableWindow from './DraggableWindow';

interface NextStepsWindowProps {
  planTitle: string;
  nextSteps: string[];
  onClose: () => void;
  zIndex: number;
}

export default function NextStepsWindow({
  planTitle,
  nextSteps,
  onClose,
  zIndex,
}: NextStepsWindowProps) {
  return (
    <DraggableWindow
      title={
        <>
          <span className="text-sm font-bold text-black">
            ✓ Copied to Clipboard
          </span>
          <span className="text-sm text-gray-700 ml-2">
            Next Steps for {planTitle}
          </span>
        </>
      }
      onClose={onClose}
      zIndex={zIndex}
      initialWidth={400}
      initialHeight={400}
      initialX={400}
      initialY={100}
      resizable={true}
    >

      {/* Warning Banner */}
      <div className="p-3 bg-yellow-100 border-b-2 border-yellow-400 flex-shrink-0">
        <p className="text-xs font-bold text-gray-800">
          ⚠️ Manual Completion Required
        </p>
        <p className="text-xs text-gray-700 mt-1">
          These steps need to be completed manually by you after the integration is set up.
        </p>
      </div>

      {/* Next Steps Content */}
      <div className="overflow-y-auto p-4 flex-1 min-h-0">
        <div className="space-y-3">
          {nextSteps.map((step, idx) => (
            <div
              key={idx}
              className="bg-white p-3 border border-gray-300 text-xs"
              style={{ boxShadow: "2px 2px 0 #000000" }}
            >
              <div className="font-bold text-gray-800 mb-2">Step {idx + 1}</div>
              <div className="text-gray-700 whitespace-pre-wrap">{step}</div>
            </div>
          ))}
        </div>
      </div>

    </DraggableWindow>
  );
}
