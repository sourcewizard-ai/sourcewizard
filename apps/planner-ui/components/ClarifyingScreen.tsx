import QuestionCard from './QuestionCard';
import { fonts } from "../lib/fonts";
import QuestionProgressBar from './QuestionProgressBar';

interface Question {
  question: string;
  options: string[];
  selected: string | null;
  additionalInfo?: string;
}

interface ClarifyingScreenProps {
  parsedQuestions: Question[];
  currentQuestionIndex: number;
  clarifyingQuestions: string;
  onPreviousQuestion: () => void;
  onAnswerSelected: (questionIndex: number, option: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export default function ClarifyingScreen({
  parsedQuestions,
  currentQuestionIndex,
  clarifyingQuestions,
  onPreviousQuestion,
  onAnswerSelected,
  onSubmit,
}: ClarifyingScreenProps) {
  const currentQuestion = parsedQuestions[currentQuestionIndex];

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="bg-yellow-100 p-4 border-l-4 border-yellow-500" style={{ fontFamily: fonts.mono }}>
        <p className="text-sm font-bold">Agent needs clarifications before generating plans</p>
      </div>

      {parsedQuestions.length > 0 ? (
        <div className="max-w-4xl mx-auto">
          <QuestionProgressBar
            currentIndex={currentQuestionIndex}
            totalQuestions={parsedQuestions.length}
          />

          <form onSubmit={onSubmit}>
            <div className="space-y-6">
              <QuestionCard
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerSelected={(option) => onAnswerSelected(currentQuestionIndex, option)}
              />

              <div className="flex gap-3">
                {currentQuestionIndex > 0 && (
                  <button
                    type="button"
                    onClick={onPreviousQuestion}
                    className="px-6 py-3 text-base bg-gray-400 text-black border-2 border-gray-500 cursor-pointer hover:bg-gray-500"
                    style={{
                      fontFamily: fonts.mono,
                      boxShadow: "2px 2px 0 #000000",
                    }}
                  >
                    ← Previous
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 text-base bg-blue-600 text-white border-2 border-blue-700 cursor-pointer hover:bg-blue-700"
                  style={{
                    fontFamily: fonts.mono,
                    boxShadow: "2px 2px 0 #000000",
                  }}
                >
                  {currentQuestionIndex < parsedQuestions.length - 1 ? 'Next →' : 'Submit Answers →'}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-4 border-2 border-gray-400" style={{ fontFamily: fonts.mono }}>
            <p className="text-sm whitespace-pre-wrap">{clarifyingQuestions}</p>
          </div>
        </div>
      )}
    </div>
  );
}
