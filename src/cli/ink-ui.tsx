import React, { useState } from "react";
import { render, useInput, useApp } from "ink";
import {
  WelcomeScreen,
  welcomeMetadata,
  MainMenuScreen,
  mainMenuMetadata,
  PackageSelectionScreen,
  packageSelectionMetadata,
  InstallationProgressScreen,
  installationProgressMetadata,
  CompletionScreen,
  getCompletionMetadata,
  ErrorScreen,
  getErrorMetadata,
  AIAnalysisScreen,
  aiAnalysisMetadata,
  SearchResultsScreen,
  getSearchResultsMetadata,
  AppLayout,
} from "./components/index.js";
import type { AppState, PageMetadata } from "./components/index.js";
import { withFullScreen } from "fullscreen-ink";

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

  // Get metadata for current screen
  const getPageMetadata = (): PageMetadata => {
    switch (state.screen) {
      case "welcome":
        return welcomeMetadata;
      case "main-menu":
        return mainMenuMetadata;
      case "package-selection":
        return packageSelectionMetadata;
      case "ai-analysis":
        return aiAnalysisMetadata;
      case "installation-progress":
        return installationProgressMetadata;
      case "completion":
        return getCompletionMetadata(state.installationSuccess);
      case "error":
        return getErrorMetadata(state.errorTitle || "Error");
      case "search-results":
        return getSearchResultsMetadata(
          state.searchQuery || "",
          state.searchResults.length
        );
      default:
        return welcomeMetadata;
    }
  };

  // Render page content
  const renderPageContent = () => {
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

  const metadata = getPageMetadata();

  return (
    <AppLayout
      title={metadata.title}
      menuTitle={metadata.menuTitle}
      menuWidth={metadata.menuWidth}
      borderColor={metadata.borderColor}
    >
      {renderPageContent()}
    </AppLayout>
  );
};

export const DOSSetupWizardInk = {
  start: () => {
    withFullScreen(<App />).start();
  },
};
