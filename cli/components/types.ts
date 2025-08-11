export interface MenuOption {
  key: string;
  label: string;
  description: string;
  action: string;
}

export interface PackageInstallationDetails {
  installedPackages?: string[];
  createdFiles?: string[];
  warnings?: string[];
}

export interface PageMetadata {
  title: string;
  menuTitle?: string;
  menuWidth?: number;
  borderColor?: string;
}

export type Screen =
  | "welcome"
  | "main-menu"
  | "package-selection"
  | "installation-progress"
  | "completion"
  | "error"
  | "ai-analysis"
  | "search-results";

export interface AppState {
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
