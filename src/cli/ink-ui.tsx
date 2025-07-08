import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import Spinner from "ink-spinner";
import { Select } from "@inkjs/ui";

interface MenuOption {
  key: string;
  label: string;
  description: string;
  action: string;
}

interface PackageInstallationDetails {
  installedPackages?: string[];
  createdFiles?: string[];
  warnings?: string[];
}

type Screen =
  | "welcome"
  | "main-menu"
  | "package-selection"
  | "installation-progress"
  | "completion"
  | "error"
  | "ai-analysis"
  | "search-results";

interface AppState {
  screen: Screen;
  selectedPackage?: string;
  packages: string[];
  searchQuery?: string;
  searchResults: any[];
  installationSuccess: boolean;
  installationDetails: PackageInstallationDetails;
  errorTitle?: string;
  errorMessage?: string;
  aiContext?: any;
  progressStep: number;
  progressSteps: string[];
}

const WelcomeScreen: React.FC<{ onContinue: () => void }> = ({
  onContinue,
}) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      padding={2}
    >
      <Box marginBottom={2}>
        <Gradient name="cristal">
          <BigText text="MCP PKG" font="chrome" />
        </Gradient>
      </Box>

      <Box
        borderStyle="double"
        borderColor="blue"
        padding={2}
        width={70}
        flexDirection="column"
        alignItems="center"
      >
        <Text color="white" bold>
          Welcome to MCP Package Manager Setup
        </Text>
        <Text> </Text>
        <Text color="gray">
          This program will install packages and code snippets
        </Text>
        <Text color="gray">with AI-powered guidance on your system.</Text>
        <Text> </Text>
        <Text color="cyan">Features:</Text>
        <Text color="green">• Smart package search and installation</Text>
        <Text color="green">• AI-guided project context detection</Text>
        <Text color="green">• Personal code snippet registry</Text>
        <Text color="green">• Support for npm, yarn, pnpm, bun</Text>
        <Text> </Text>
        <Text color="yellow" bold>
          Press any key to continue...
        </Text>
      </Box>
    </Box>
  );
};

const MainMenuScreen: React.FC<{ onSelect: (action: string) => void }> = ({
  onSelect,
}) => {
  const mainMenuOptions: MenuOption[] = [
    {
      key: "A",
      label: "Search Packages",
      description: "Search for packages and code snippets in the registry",
      action: "search",
    },
    {
      key: "B",
      label: "Install Package/Snippet",
      description: "Install packages or code snippets with AI guidance",
      action: "install",
    },
    {
      key: "C",
      label: "View Package Information",
      description: "Get detailed information about a specific package",
      action: "info",
    },
    {
      key: "D",
      label: "List All Items",
      description: "Browse all available packages and snippets",
      action: "list",
    },
    {
      key: "E",
      label: "Add New Package/Snippet",
      description: "Add new packages or snippets to the registry",
      action: "add",
    },
    {
      key: "F",
      label: "Registry Statistics",
      description: "View usage statistics and analytics",
      action: "stats",
    },
    {
      key: "G",
      label: "Exit",
      description: "Exit the MCP Package Manager",
      action: "exit",
    },
  ];

  const items = mainMenuOptions.map((option) => ({
    label: option.label,
    value: option.action,
    description: option.description,
  }));

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor="blue"
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          MCP Package Manager - Main Menu
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor="cyan"
          padding={2}
          width={80}
          flexDirection="column"
        >
          <Text color="cyan" bold>
            Main Menu
          </Text>
          <Text> </Text>
          <Select
            items={items}
            onSelect={(item) => onSelect(item.value)}
            itemComponent={({ item, isSelected }) => (
              <Box>
                <Text color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "► " : "  "}
                  {item.label}
                </Text>
                <Text color="gray" dimColor>
                  {isSelected
                    ? `  ► ${item.description}`
                    : `    ${item.description}`}
                </Text>
              </Box>
            )}
          />
          <Text> </Text>
          <Text color="gray">
            Use ↑↓ arrows to navigate, ENTER to select, ESC to exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const PackageSelectionScreen: React.FC<{
  packages: string[];
  onSelect: (pkg: string) => void;
}> = ({ packages, onSelect }) => {
  const getPackageDescription = (packageName: string): string => {
    const descriptions: Record<string, string> = {
      express: "Fast, unopinionated, minimalist web framework for Node.js",
      react: "A JavaScript library for building user interfaces",
      lodash:
        "A modern JavaScript utility library delivering modularity, performance & extras",
      axios: "Promise based HTTP client for the browser and node.js",
      typescript:
        "TypeScript is a superset of JavaScript that compiles to plain JavaScript",
      webpack: "A bundler for javascript and friends",
      eslint: "Find and fix problems in your JavaScript code",
    };
    return descriptions[packageName] || `Package: ${packageName}`;
  };

  const items = packages.map((pkg) => ({
    label: pkg,
    value: pkg,
    description: getPackageDescription(pkg),
  }));

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor="blue"
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          MCP Package Manager - Package Selection
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor="cyan"
          padding={2}
          width={80}
          flexDirection="column"
        >
          <Text color="cyan" bold>
            Select Package to Install
          </Text>
          <Text> </Text>
          <Select
            items={items}
            onSelect={(item) => onSelect(item.value)}
            itemComponent={({ item, isSelected }) => (
              <Box>
                <Text color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "► " : "  "}
                  {item.label}
                </Text>
                <Text color="gray" dimColor>
                  {isSelected
                    ? `  ► ${item.description}`
                    : `    ${item.description}`}
                </Text>
              </Box>
            )}
          />
          <Text> </Text>
          <Text color="gray">
            Use ↑↓ arrows to navigate, ENTER to select, ESC to exit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const ProgressBar: React.FC<{
  current: number;
  total: number;
  width?: number;
}> = ({ current, total, width = 40 }) => {
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  const percentage = Math.floor((current / total) * 100);

  return (
    <Box flexDirection="column" alignItems="center">
      <Box>
        <Text color="cyan">╔</Text>
        <Text color="cyan">{"═".repeat(width + 2)}</Text>
        <Text color="cyan">╗</Text>
      </Box>
      <Box>
        <Text color="cyan">║ </Text>
        <Text color="green">{"█".repeat(filled)}</Text>
        <Text color="gray">{"░".repeat(empty)}</Text>
        <Text color="cyan"> ║ </Text>
        <Text color="white">{percentage}%</Text>
      </Box>
      <Box>
        <Text color="cyan">╚</Text>
        <Text color="cyan">{"═".repeat(width + 2)}</Text>
        <Text color="cyan">╝</Text>
      </Box>
    </Box>
  );
};

const InstallationProgressScreen: React.FC<{
  packageName: string;
  step: number;
  steps: string[];
}> = ({ packageName, step, steps }) => {
  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor="blue"
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          MCP Package Manager - Installing
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor="cyan"
          padding={2}
          width={60}
          flexDirection="column"
          alignItems="center"
        >
          <Text color="cyan" bold>
            Installation in Progress
          </Text>
          <Text> </Text>
          <Text color="white">
            Installing package:{" "}
            <Text color="green" bold>
              {packageName}
            </Text>
          </Text>
          <Text> </Text>
          <Text color="gray">
            Please wait while the package is being installed
          </Text>
          <Text color="gray">and configured for your project...</Text>
          <Text> </Text>
          <Text color="white">
            Current step: {step}/{steps.length}
          </Text>
          <Text color="yellow">{steps[step - 1]}</Text>
          <Text> </Text>
          <ProgressBar current={step} total={steps.length} />
        </Box>
      </Box>
    </Box>
  );
};

const CompletionScreen: React.FC<{
  packageName: string;
  success: boolean;
  details: PackageInstallationDetails;
  onContinue: () => void;
}> = ({ packageName, success, details, onContinue }) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor={success ? "green" : "red"}
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          MCP Package Manager -{" "}
          {success ? "Installation Complete" : "Installation Failed"}
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor={success ? "green" : "red"}
          padding={2}
          width={70}
          flexDirection="column"
        >
          <Text color={success ? "green" : "red"} bold>
            {success ? "Installation Complete" : "Installation Failed"}
          </Text>
          <Text> </Text>
          <Text color="white">
            Package: <Text color="cyan">{packageName}</Text>
          </Text>
          <Text color="white">
            Status:{" "}
            <Text color={success ? "green" : "red"}>
              {success ? "✓ SUCCESS" : "✗ FAILED"}
            </Text>
          </Text>
          <Text> </Text>

          {success && details.installedPackages?.length && (
            <>
              <Text color="cyan">Installed packages:</Text>
              {details.installedPackages.map((pkg, i) => (
                <Text key={i} color="green">
                  • {pkg}
                </Text>
              ))}
              <Text> </Text>
            </>
          )}

          {success && details.createdFiles?.length && (
            <>
              <Text color="cyan">Created files:</Text>
              {details.createdFiles.map((file, i) => (
                <Text key={i} color="green">
                  • {file}
                </Text>
              ))}
              <Text> </Text>
            </>
          )}

          {success && details.warnings?.length && (
            <>
              <Text color="yellow">Warnings:</Text>
              {details.warnings.map((warning, i) => (
                <Text key={i} color="yellow">
                  ⚠ {warning}
                </Text>
              ))}
              <Text> </Text>
            </>
          )}

          <Text color="yellow" bold>
            Press any key to continue...
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const ErrorScreen: React.FC<{
  title: string;
  message: string;
  onContinue: () => void;
}> = ({ title, message, onContinue }) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <Box
      flexDirection="column"
      height="100%"
      padding={2}
      justifyContent="center"
      alignItems="center"
    >
      <Box
        borderStyle="double"
        borderColor="red"
        padding={2}
        width={60}
        flexDirection="column"
        alignItems="center"
      >
        <Text color="red" bold>
          ⚠ {title}
        </Text>
        <Text> </Text>
        {message.split("\n").map((line, i) => (
          <Text key={i} color="white">
            {line}
          </Text>
        ))}
        <Text> </Text>
        <Text color="yellow" bold>
          Press any key to continue...
        </Text>
      </Box>
    </Box>
  );
};

const AIAnalysisScreen: React.FC<{
  context: any;
  onComplete: () => void;
}> = ({ context, onComplete }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnalyzing(false);
      setTimeout(onComplete, 1000);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor="blue"
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          MCP Package Manager - AI Analysis
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor="cyan"
          padding={2}
          width={65}
          flexDirection="column"
        >
          <Text color="cyan" bold>
            AI Context Detection
          </Text>
          <Text> </Text>
          <Text color="white">AI Project Analysis Results:</Text>
          <Text> </Text>
          <Box borderStyle="single" borderColor="gray" padding={1}>
            <Box flexDirection="column">
              <Text color="white">
                Project Type:{" "}
                <Text color="cyan">{context.projectType || "Unknown"}</Text>
              </Text>
              <Text color="white">
                Framework:{" "}
                <Text color="cyan">{context.framework || "None"}</Text>
              </Text>
              <Text color="white">
                Language:{" "}
                <Text color="cyan">{context.language || "Unknown"}</Text>
              </Text>
              <Text color="white">
                Pkg Manager:{" "}
                <Text color="cyan">{context.packageManager || "Unknown"}</Text>
              </Text>
            </Box>
          </Box>
          <Text> </Text>
          <Text color="gray">
            The AI has analyzed your project and will provide
          </Text>
          <Text color="gray">optimized installation instructions.</Text>
          <Text> </Text>
          {isAnalyzing ? (
            <Box justifyContent="center">
              <Text color="cyan">
                <Spinner type="dots" /> AI analyzing...
              </Text>
            </Box>
          ) : (
            <Box justifyContent="center">
              <Text color="green">✓ Analysis complete!</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const SearchResultsScreen: React.FC<{
  results: any[];
  query: string;
  onContinue: () => void;
}> = ({ results, query, onContinue }) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      <Box
        borderStyle="double"
        borderColor="blue"
        padding={1}
        marginBottom={2}
        justifyContent="center"
      >
        <Text color="white" bold>
          Search Results for: {query}
        </Text>
      </Box>

      <Box flex={1} justifyContent="center" alignItems="center">
        <Box
          borderStyle="single"
          borderColor="cyan"
          padding={2}
          width={80}
          flexDirection="column"
        >
          <Text color="cyan" bold>
            Found {results.length} Results
          </Text>
          <Text> </Text>
          {results.slice(0, 8).map((item, i) => {
            const name = item.name || item.id || "Unknown";
            const type = item.version ? "PKG" : "SNP";
            const desc = (item.description || "").substring(0, 45);
            return (
              <Box key={i} marginBottom={1}>
                <Text color="white">{i + 1}. </Text>
                <Text color="cyan">[{type}] </Text>
                <Text color="green">{name.padEnd(20)} </Text>
                <Text color="gray">{desc}</Text>
              </Box>
            );
          })}
          <Text> </Text>
          <Text color="yellow" bold>
            Press any key to continue...
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const App: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    screen: "welcome",
    packages: [
      "express",
      "react",
      "lodash",
      "axios",
      "typescript",
      "webpack",
      "eslint",
    ],
    searchResults: [],
    installationSuccess: false,
    installationDetails: {},
    progressStep: 0,
    progressSteps: [
      "Analyzing project context...",
      "Detecting package manager...",
      "Downloading package...",
      "Installing dependencies...",
      "Configuring package...",
      "Applying AI setup...",
      "Installation complete!",
    ],
  });

  const handleWelcomeContinue = () => {
    setState((prev) => ({ ...prev, screen: "main-menu" }));
  };

  const handleMainMenuSelect = (action: string) => {
    if (action === "exit") {
      exit();
      return;
    }

    switch (action) {
      case "search":
        setState((prev) => ({
          ...prev,
          screen: "search-results",
          searchQuery: "example search",
          searchResults: [
            {
              name: "express",
              version: "4.18.0",
              description: "Fast web framework",
            },
            { name: "react", version: "18.2.0", description: "UI library" },
          ],
        }));
        break;
      case "install":
        setState((prev) => ({ ...prev, screen: "package-selection" }));
        break;
      default:
        setState((prev) => ({
          ...prev,
          screen: "error",
          errorTitle: "Feature Not Implemented",
          errorMessage: `The "${action}" feature is not yet implemented.`,
        }));
    }
  };

  const handlePackageSelect = (pkg: string) => {
    setState((prev) => ({
      ...prev,
      screen: "ai-analysis",
      selectedPackage: pkg,
      aiContext: {
        projectType: "Web Application",
        framework: "Express.js",
        language: "TypeScript",
        packageManager: "npm",
      },
    }));
  };

  const handleAIAnalysisComplete = () => {
    setState((prev) => ({
      ...prev,
      screen: "installation-progress",
      progressStep: 1,
    }));

    // Simulate installation progress
    const interval = setInterval(() => {
      setState((prev) => {
        const nextStep = prev.progressStep + 1;
        if (nextStep > prev.progressSteps.length) {
          clearInterval(interval);
          return {
            ...prev,
            screen: "completion",
            installationSuccess: true,
            installationDetails: {
              installedPackages: [prev.selectedPackage || "unknown"],
              createdFiles: ["package.json", "tsconfig.json"],
              warnings: [],
            },
          };
        }
        return { ...prev, progressStep: nextStep };
      });
    }, 1000);
  };

  const handleCompletionContinue = () => {
    setState((prev) => ({ ...prev, screen: "main-menu" }));
  };

  const handleErrorContinue = () => {
    setState((prev) => ({ ...prev, screen: "main-menu" }));
  };

  const handleSearchResultsContinue = () => {
    setState((prev) => ({ ...prev, screen: "main-menu" }));
  };

  // Handle ESC key globally
  useInput((input, key) => {
    if (key.escape) {
      if (state.screen === "main-menu") {
        exit();
      } else {
        setState((prev) => ({ ...prev, screen: "main-menu" }));
      }
    }
  });

  switch (state.screen) {
    case "welcome":
      return <WelcomeScreen onContinue={handleWelcomeContinue} />;

    case "main-menu":
      return <MainMenuScreen onSelect={handleMainMenuSelect} />;

    case "package-selection":
      return (
        <PackageSelectionScreen
          packages={state.packages}
          onSelect={handlePackageSelect}
        />
      );

    case "ai-analysis":
      return (
        <AIAnalysisScreen
          context={state.aiContext}
          onComplete={handleAIAnalysisComplete}
        />
      );

    case "installation-progress":
      return (
        <InstallationProgressScreen
          packageName={state.selectedPackage || "unknown"}
          step={state.progressStep}
          steps={state.progressSteps}
        />
      );

    case "completion":
      return (
        <CompletionScreen
          packageName={state.selectedPackage || "unknown"}
          success={state.installationSuccess}
          details={state.installationDetails}
          onContinue={handleCompletionContinue}
        />
      );

    case "error":
      return (
        <ErrorScreen
          title={state.errorTitle || "Error"}
          message={state.errorMessage || "Unknown error"}
          onContinue={handleErrorContinue}
        />
      );

    case "search-results":
      return (
        <SearchResultsScreen
          results={state.searchResults}
          query={state.searchQuery || ""}
          onContinue={handleSearchResultsContinue}
        />
      );

    default:
      return <WelcomeScreen onContinue={handleWelcomeContinue} />;
  }
};

export const DOSSetupWizardInk = {
  start: () => {
    render(<App />);
  },
};
