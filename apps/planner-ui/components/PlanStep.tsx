import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface PlanStepProps {
  step: string;
  index: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const colorMap = {
  blue: 'text-blue-700',
  green: 'text-green-700',
  purple: 'text-purple-700',
  orange: 'text-orange-700'
};

// Collapsible code block component with stable ID and external state
function CollapsibleCodeBlock({
  children,
  blockId,
  isExpanded,
  onToggle
}: {
  children: React.ReactNode;
  blockId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
      <button
        onClick={onToggle}
        style={{
          backgroundColor: '#333',
          color: '#e0e0e0',
          border: '1px solid #555',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          fontFamily: "monospace",
          width: '100%',
          textAlign: 'left',
        }}
      >
        {isExpanded ? '▼ Collapse Code' : '▶ Expand Code'}
      </button>
      {isExpanded && (
        <pre
          style={{
            backgroundColor: '#1a1a1a',
            color: '#e0e0e0',
            padding: '1rem',
            border: '2px solid #333',
            borderTop: 'none',
            overflowX: 'auto',
            fontFamily: "monospace",
            fontSize: '0.875rem',
            whiteSpace: 'pre',
            maxWidth: '100%',
            margin: 0,
          }}
        >
          {children}
        </pre>
      )}
    </div>
  );
}

export default function PlanStep({ step, index, color }: PlanStepProps) {
  // Use state to track which code blocks are expanded (by blockId)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  // Use a ref to track code block counter for this step
  const codeBlockCounter = useRef(0);

  // Helper function to unescape markdown content
  const unescapeMarkdown = (text: string): string => {
    if (!text) return '';
    // Convert escaped newlines to actual newlines
    return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  };

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  // Reset counter before rendering
  codeBlockCounter.current = 0;

  return (
    <div className="bg-white p-4 border border-gray-300">
      <div>
        <div
          className="prose prose-lg max-w-none"
          style={{
            lineHeight: "1.8",
            color: "#1a1a1a",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "0.875rem",
            overflowWrap: "break-word",
            wordBreak: "break-word"
          }}
        >
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              pre: ({ node, children, ...props }: any) => {
                // Block code comes wrapped in <pre>, so intercept it here
                // Generate stable ID based on step index and code block order
                const blockId = `step-${index}-code-${codeBlockCounter.current++}`;
                return (
                  <CollapsibleCodeBlock
                    blockId={blockId}
                    isExpanded={expandedBlocks.has(blockId)}
                    onToggle={() => toggleBlock(blockId)}
                  >
                    {children}
                  </CollapsibleCodeBlock>
                );
              },
              code: ({ node, inline, className, children, ...props }: any) => {
                // Only handle inline code here, block code is handled by pre
                // If it's inline code (or no className), use inline styling
                if (inline || !className) {
                  return (
                    <code
                      style={{
                        backgroundColor: "#f5f5f5",
                        color: "#c7254e",
                        fontFamily: "monospace",
                        padding: "0.125rem 0.25rem",
                        borderRadius: "0",
                        border: "1px solid #d0d0d0",
                        fontSize: "0.875rem",
                        overflowWrap: "break-word",
                        wordBreak: "break-word"
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                // Block code inside pre - just pass through with proper styling
                return (
                  <code
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      padding: "0",
                      fontSize: "inherit",
                      display: "block",
                      whiteSpace: "pre"
                    }}
                    className={className}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              a: ({ node, ...props }: any) => (
                <a
                  className="text-blue-600 hover:text-blue-800 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    overflowWrap: "break-word",
                    wordBreak: "break-all"
                  }}
                  {...props}
                />
              ),
              p: ({ node, children, ...props }: any) => {
                const hasCodeBlock = node?.children?.some((child: any) =>
                  child.tagName === 'code' || child.tagName === 'pre'
                );
                if (hasCodeBlock) {
                  return <>{children}</>;
                }
                return <p className="mb-4" {...props}>{children}</p>;
              },
              h1: ({ node, ...props }: any) => (
                <h1 className="font-bold mt-6 mb-4" style={{ fontFamily: "monospace", fontSize: "24px" }} {...props} />
              ),
              h2: ({ node, ...props }: any) => (
                <h2 className="font-bold mt-5 mb-3" style={{ fontFamily: "monospace", fontSize: `calc(${"24px"} * 0.85)` }} {...props} />
              ),
              h3: ({ node, ...props }: any) => (
                <h3 className="font-bold mt-4 mb-2" style={{ fontFamily: "monospace", fontSize: `calc(${"24px"} * 0.7)` }} {...props} />
              ),
              ul: ({ node, ...props }: any) => (
                <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />
              ),
              ol: ({ node, ...props }: any) => (
                <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />
              ),
              li: ({ node, ...props }: any) => (
                <li className="mb-1" {...props} />
              ),
            }}
          >
            {unescapeMarkdown(step)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
