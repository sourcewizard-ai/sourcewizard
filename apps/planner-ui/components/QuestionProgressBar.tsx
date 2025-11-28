interface QuestionProgressBarProps {
  currentIndex: number;
  totalQuestions: number;
}

export default function QuestionProgressBar({
  currentIndex,
  totalQuestions,
}: QuestionProgressBarProps) {
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <div className="mb-4 bg-gray-200 p-3 border border-gray-400" style={{ fontFamily: "monospace" }}>
      <p className="text-xs mb-2">Question {currentIndex + 1} of {totalQuestions}</p>
      <div className="w-full bg-gray-300 h-2 border border-gray-400">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
