import { useState, useRef, useEffect } from 'react';
interface PackageSuggestion {
  id: string;
  name: string;
  description: string;
  language: string;
  tags: string[];
}

interface SearchInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  skipAutocompleteRef?: React.MutableRefObject<boolean>;
}

export default function SearchInput({ onSubmit, placeholder = "Type package name or what do you need...", value: externalValue, onChange: externalOnChange, skipAutocompleteRef: externalSkipRef }: SearchInputProps) {
  const [internalValue, setInternalValue] = useState('');

  // Use external value if provided, otherwise use internal state
  const inputValue = externalValue !== undefined ? externalValue : internalValue;
  const setInputValue = externalOnChange !== undefined ? externalOnChange : setInternalValue;
  const [suggestions, setSuggestions] = useState<PackageSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const internalSkipRef = useRef(false);
  const skipAutocompleteRef = externalSkipRef || internalSkipRef;

  // Fetch suggestions when input changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Skip autocomplete if a suggestion was just clicked
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    if (inputValue.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search_packages?q=${encodeURIComponent(inputValue.trim())}&limit=8&autocomplete=true`);
        const data = await response.json();
        setSuggestions(data.packages || []);
        setShowSuggestions(data.packages && data.packages.length > 0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
    }
  };

  const handleSuggestionClick = (suggestion: PackageSuggestion) => {
    skipAutocompleteRef.current = true;
    setInputValue(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
    onSubmit(suggestion.name);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder={placeholder}
              className="w-full p-2 sm:p-4 text-sm sm:text-base bg-white border-2 border-gray-400 text-black"
              style={{
                fontFamily: "monospace",
                boxShadow: "inset 2px 2px 0 #808080, 4px 4px 0 #000000",
              }}
              autoFocus
            />
            {isLoadingSuggestions && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-blue-600 rounded-full"></div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-3 sm:px-6 text-base sm:text-lg bg-blue-600 text-white border-2 border-blue-700 cursor-pointer hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:border-gray-500"
            style={{
              fontFamily: "monospace",
              boxShadow: "4px 4px 0 #000000",
            }}
          >
            →
          </button>
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-400 max-h-64 overflow-y-auto"
            style={{
              fontFamily: "monospace",
              boxShadow: "4px 4px 0 #000000",
            }}
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left p-3 hover:bg-gray-100 border-b border-gray-200 last:border-b-0 cursor-pointer"
              >
                <div className="font-bold text-sm text-blue-700">{suggestion.name}</div>
                <div className="text-xs text-gray-700 mt-1">{suggestion.description}</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-gray-200 px-2 py-0.5 border border-gray-300">
                    {suggestion.language}
                  </span>
                  {suggestion.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs bg-blue-100 px-2 py-0.5 border border-blue-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
