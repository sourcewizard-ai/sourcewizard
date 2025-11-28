interface ProgressBarProps {
  progress: number; // 0-100
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="border-2 border-gray-800 bg-white p-0.5">
      <div className="flex gap-px h-4">
        {Array.from({ length: 30 }).map((_, idx) => {
          const barThreshold = ((idx + 1) / 30) * 100;
          return (
            <div
              key={idx}
              className="w-2"
              style={{
                backgroundColor: barThreshold <= progress ? '#0066cc' : 'transparent'
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
