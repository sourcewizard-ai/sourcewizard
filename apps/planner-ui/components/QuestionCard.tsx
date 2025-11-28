import { fonts } from "../lib/fonts";

interface Question {
  question: string;
  options: string[];
  selected: string | null;
  additionalInfo?: string;
}

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  onAnswerSelected: (option: string) => void;
}

export default function QuestionCard({
  question,
  questionIndex,
  onAnswerSelected,
}: QuestionCardProps) {
  return (
    <div className="bg-white p-6 border-2 border-gray-400" style={{ fontFamily: fonts.mono, boxShadow: "2px 2px 0 #000000" }}>
      <p className="text-base font-bold mb-4">{question.question}</p>

      <div className="space-y-2">
        {question.options.map((option, oIdx) => (
          <label
            key={oIdx}
            className="flex items-center p-3 border border-gray-300 cursor-pointer hover:bg-gray-50"
            style={{ fontFamily: fonts.mono }}
          >
            <input
              type="radio"
              name={`question-${questionIndex}`}
              value={option}
              checked={question.selected === option}
              onChange={() => onAnswerSelected(option)}
              className="mr-3"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>

      {question.additionalInfo && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 text-xs" style={{ fontFamily: fonts.mono }}>
          <span dangerouslySetInnerHTML={{ __html: question.additionalInfo.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>') }} />
        </div>
      )}
    </div>
  );
}
