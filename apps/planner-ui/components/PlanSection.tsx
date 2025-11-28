import { useState } from 'react';
import PlanStep from './PlanStep';

interface PlanSectionProps {
  title: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  steps: string[];
  summary?: string;
  alwaysExpanded?: boolean;
  note?: string;
}

const colorMap = {
  blue: { text: 'text-blue-700', border: 'border-blue-300' },
  green: { text: 'text-green-700', border: 'border-green-300' },
  purple: { text: 'text-purple-700', border: 'border-purple-300' },
  orange: { text: 'text-orange-700', border: 'border-orange-300' }
};

export default function PlanSection({ title, icon, color, steps, summary, alwaysExpanded = false, note }: PlanSectionProps) {
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded);

  if (!steps || steps.length === 0) return null;

  const expanded = alwaysExpanded || isExpanded;

  return (
    <div>
      {alwaysExpanded ? (
        <div className={`w-full text-left text-sm font-bold mb-2 ${colorMap[color].text} pb-1 flex items-center justify-between`}>
          <span>
            {icon && <span>{icon} </span>}{title}
          </span>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full text-left text-sm font-bold mb-2 ${colorMap[color].text} pb-1 cursor-pointer hover:opacity-80 flex items-center justify-between`}
        >
          <span>
            {icon && <span>{icon} </span>}{title}
          </span>
          <span className="text-xs">{expanded ? '▼' : '▶'}</span>
        </button>
      )}

      {note && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 text-xs text-gray-800" style={{ boxShadow: '2px 2px 0 #000000' }}>
          <strong>Note:</strong> {note}
        </div>
      )}

      {!expanded && summary && (
        <div
          className="mb-3 p-3 bg-gray-100 border border-gray-500 text-xs text-gray-700 cursor-pointer hover:bg-gray-200"
          style={{ boxShadow: '2px 2px 0 #000000' }}
          onClick={() => setIsExpanded(true)}
        >
          {summary}
        </div>
      )}

      {expanded && (
        <div className="space-y-3">
          {!alwaysExpanded && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-300 text-xs text-gray-800" style={{ boxShadow: '2px 2px 0 #000000' }}>
              <strong>Note:</strong> These instructions are tailored for coding agents (Cursor, Claude Code) to run.
            </div>
          )}
          {steps.map((step, idx) => (
            <PlanStep key={`${title}-${idx}`} step={step} index={idx} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}
