import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import SearchInput from './SearchInput';
import { supabase } from '../lib/supabase';

interface IntegrationSelectScreenProps {
  selectedFolder: string;
  cwdPath: string;
  sessionId: string | null;
  selectedIntegration: string;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  onRepositoryChange: (repo: string) => void;
  onBranchChange: (branch: string) => void;
  onInstallationIdChange: (installationId: number) => void;
}

interface GitHubInstallation {
  id: string;
  name: string;
  url: string;
  github_id: number;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url?: string;
  default_branch: string;
}

interface PackageItem {
  id: string;
  name: string;
  icon?: string;
}

const packagesUnsorted: PackageItem[] = [
  {
    id: "workos-authkit",
    icon: "workos-authkit.png",
    name: "WorkOS Authkit",
  },
  {
    id: "clerk",
    name: "Clerk",
    icon: "clerk.png",
  },
  {
    id: "monday-com",
    name: "Monday.com",
    icon: "monday.png",
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    icon: "firecrawl.png",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: "mailchimp.png",
  },
  {
    id: "resend",
    name: "Resend",
    icon: "resend.png",
  },
  {
    id: "arcjet",
    name: "Arcjet",
    icon: "arcjet.png",
  },
  {
    id: "knock",
    name: "Knock",
    icon: "knock.jpg",
  },
  {
    id: "vercel-analytics",
    name: "Vercel Analytics",
    icon: "vercel.png",
  },
  {
    id: "posthog",
    name: "PostHog",
    icon: "posthog.png",
  },
  {
    id: "sentry",
    name: "Sentry",
    icon: "sentry.avif",
  },
  {
    id: "statsig",
    name: "Statsig",
    icon: "statsig.avif",
  },
  {
    id: "weave",
    name: "Weave",
    icon: "weave.webp",
  },
  {
    id: "betterauth",
    name: "BetterAuth",
    icon: "betterauth.png",
  },
];

const packages = [...packagesUnsorted].sort((a, b) => a.name.localeCompare(b.name));

function FolderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <path
        d="M6 12 L20 12 L24 8 L42 8 L42 38 L6 38 Z"
        fill="#FFFF00"
        stroke="#000"
        strokeWidth="2"
      />
      <path
        d="M6 12 L6 38 L42 38 L42 14 L24 14 L20 12 Z"
        fill="#FFFF00"
        stroke="#000"
        strokeWidth="2"
      />
      <rect x="8" y="14" width="32" height="22" fill="#FFFF77" />
    </svg>
  );
}

function getPackageIcon(icon?: string, priority: boolean = false) {
  if (icon) {
    return (
      <Image
        src={`/icons/packages/${icon}`}
        alt={icon}
        width={48}
        height={48}
        priority={priority}
        loading={priority ? undefined : "eager"}
        style={{
          imageRendering: "auto",
          objectFit: "contain",
        }}
        unoptimized={false}
      />
    );
  }

  return <FolderIcon />;
}

interface PackageIconProps {
  name: string;
  icon?: string;
  onClick: () => void;
  priority?: boolean;
  isSelected?: boolean;
}

function PackageIcon({ name, icon, onClick, priority = false, isSelected = false }: PackageIconProps) {
  return (
    <div
      className={`flex flex-col items-center p-2 cursor-pointer ${isSelected ? 'bg-blue-200 border-2 border-blue-500' : 'hover:bg-gray-100 border-2 border-transparent'}`}
      onClick={onClick}
      style={{
        width: "84px",
      }}
    >
      <div className="mb-1">{getPackageIcon(icon, priority)}</div>
      <span
        className="text-[11px] text-center leading-tight text-black"
        style={{
          fontFamily: "monospace",
          wordWrap: "break-word",
          maxWidth: "100px",
        }}
      >
        {name}
      </span>
    </div>
  );
}

export default function IntegrationSelectScreen({
  selectedFolder,
  cwdPath,
  sessionId,
  selectedIntegration,
  inputValue,
  setInputValue,
  handleSubmit,
  onRepositoryChange,
  onBranchChange,
  onInstallationIdChange,
}: IntegrationSelectScreenProps) {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string>('');
  const [isLoadingInstallations, setIsLoadingInstallations] = useState(true);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [dropdownSearchTerm, setDropdownSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchSearchTerm, setBranchSearchTerm] = useState<string>('');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [showRepositoryWarning, setShowRepositoryWarning] = useState(false);
  const skipAutocompleteRef = useRef(false);

  useEffect(() => {
    async function fetchInstallations() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/github-repositories', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const validInstallations = data.installations?.filter((inst: GitHubInstallation) => inst.url) || [];
          setInstallations(validInstallations);
        }
      } catch (error) {
        console.error('Error fetching installations:', error);
      } finally {
        setIsLoadingInstallations(false);
      }
    }

    fetchInstallations();
  }, []);

  async function fetchRepositories(installationId: number) {
    setIsLoadingRepos(true);
    setRepositories([]);
    setSelectedRepository('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        return;
      }

      console.log('Fetching repositories for installation:', installationId);
      const response = await fetch(`/api/github-installation-repos?installation_id=${installationId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Repositories data:', data);
        setRepositories(data.repositories || []);
      } else if (response.status === 404) {
        // Installation was removed from GitHub
        console.error('Installation not found - was it removed from GitHub?');
        // Reload the page to show the GitHub connect popup
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch repositories:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
    } finally {
      setIsLoadingRepos(false);
    }
  }

  async function fetchBranches(repoFullName: string) {
    setIsLoadingBranches(true);
    setBranches([]);

    // Optimistically set 'main' as the default branch immediately
    const optimisticBranch = 'main';
    setSelectedBranch(optimisticBranch);
    setBranchSearchTerm(optimisticBranch);
    onBranchChange(optimisticBranch);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || installations.length === 0) {
        console.error('No session or installation found');
        return;
      }

      console.log('Fetching branches for repository:', repoFullName);
      const response = await fetch(`/api/github-branches?installation_id=${installations[0].github_id}&repo=${repoFullName}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      console.log('Branches response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Branches data:', data);
        setBranches(data.branches || []);
        if (data.branches && data.branches.length > 0) {
          // Verify and adjust the default branch based on actual branches
          let defaultBranch = data.branches[0];
          if (data.branches.includes('main')) {
            defaultBranch = 'main';
          } else if (data.branches.includes('master')) {
            defaultBranch = 'master';
          }
          // Only update if different from optimistic value
          if (defaultBranch !== optimisticBranch) {
            setSelectedBranch(defaultBranch);
            setBranchSearchTerm(defaultBranch);
            onBranchChange(defaultBranch);
          }
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch branches:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  }

  const handleSearchSubmit = (value: string) => {
    if (!selectedRepository || !selectedBranch) {
      return;
    }
    setInputValue(value);
    // Create a synthetic form event
    const syntheticEvent = {
      preventDefault: () => { },
    } as React.FormEvent;
    handleSubmit(syntheticEvent);
  };

  const handlePackageClick = (packageName: string) => {
    if (!selectedRepository || !selectedBranch) {
      setShowRepositoryWarning(true);
      setTimeout(() => setShowRepositoryWarning(false), 3000);
      return;
    }

    // First click: select package and fill search bar
    if (selectedPackage !== packageName) {
      setSelectedPackage(packageName);
      skipAutocompleteRef.current = true;
      setInputValue(packageName);
      return;
    }

    // Second click: trigger search
    const syntheticEvent = {
      preventDefault: () => { },
    } as React.FormEvent;
    handleSubmit(syntheticEvent);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-2 sm:p-4 md:p-6">
      {/* Search Header - Moved Higher */}
      <div className="flex items-start justify-center pt-1 pb-2 flex-shrink-0">
        <div className="max-w-4xl w-full px-2 sm:px-4">
          <h1 className="font-bold mb-2 text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl" style={{ fontFamily: "var(--font-vollkorn)" }}>
            Search for a package to integrate
          </h1>

          <SearchInput
            onSubmit={handleSearchSubmit}
            placeholder="Type package name or what do you need..."
            value={inputValue}
            onChange={setInputValue}
            skipAutocompleteRef={skipAutocompleteRef}
          />

          {/* Repository and Branch Selection */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 relative">
            {/* Warning Message - Absolute positioned */}
            {showRepositoryWarning && (
              <div
                className="absolute top-full left-0 mt-2 p-3 bg-yellow-100 border-2 border-yellow-500 text-black text-sm z-50 max-w-full"
                style={{
                  fontFamily: "monospace",
                  boxShadow: '2px 2px 0 #000000',
                }}
              >
                ⚠️ Please select a repository and branch first
              </div>
            )}
            {/* Repository Selection Dropdown */}
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                value={dropdownSearchTerm}
                onChange={(e) => setDropdownSearchTerm(e.target.value)}
                onFocus={(e) => {
                  setShowDropdown(true);
                  // Select all text on focus so user can start typing immediately
                  e.target.select();
                  if (repositories.length === 0 && !isLoadingRepos && installations.length > 0) {
                    fetchRepositories(installations[0].github_id);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on dropdown items
                  setTimeout(() => setShowDropdown(false), 200);
                }}
                placeholder={isLoadingInstallations ? "Loading installations..." : installations.length === 0 ? "No GitHub installations found" : "Select Repository"}
                disabled={isLoadingInstallations || installations.length === 0}
                className="w-full px-2 py-2 bg-gray-100 text-black border border-gray-400 cursor-text disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-xs"
                style={{
                  fontFamily: "monospace",
                  maxWidth: '180px',
                }}
              />
              {showDropdown && repositories.length > 0 && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white border-2 border-gray-500 z-50 max-h-60 overflow-y-auto"
                  style={{
                    fontFamily: "monospace",
                    boxShadow: '2px 2px 0 #000000',
                    minWidth: '250px',
                    maxWidth: '400px',
                  }}
                >
                  {(() => {
                    const searchLower = dropdownSearchTerm.toLowerCase();

                    if (!searchLower) {
                      // No search term, show all repositories
                      return repositories.map((repo) => (
                        <div
                          key={repo.id}
                          onClick={() => {
                            setSelectedRepository(repo.full_name);
                            setDropdownSearchTerm(repo.full_name);
                            setShowDropdown(false);
                            onRepositoryChange(repo.clone_url || `${repo.html_url}.git`);
                            if (installations.length > 0) {
                              onInstallationIdChange(installations[0].github_id);
                            }
                            fetchBranches(repo.full_name);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-200"
                        >
                          {repo.full_name}
                        </div>
                      ));
                    }

                    // With search term, show matching first, then non-matching
                    const matching = repositories.filter(repo =>
                      repo.full_name.toLowerCase().includes(searchLower)
                    );
                    const nonMatching = repositories.filter(repo =>
                      !repo.full_name.toLowerCase().includes(searchLower)
                    );
                    const sortedRepos = [...matching, ...nonMatching];

                    return sortedRepos.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => {
                          setSelectedRepository(repo.full_name);
                          setDropdownSearchTerm(repo.full_name);
                          setShowDropdown(false);
                          onRepositoryChange(repo.clone_url || `${repo.html_url}.git`);
                          if (installations.length > 0) {
                            onInstallationIdChange(installations[0].github_id);
                          }
                          fetchBranches(repo.full_name);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-200"
                      >
                        {repo.full_name}
                      </div>
                    ));
                  })()}
                </div>
              )}
              {showDropdown && isLoadingRepos && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white border-2 border-gray-500 z-50 px-3 py-2"
                  style={{
                    fontFamily: "monospace",
                    boxShadow: '2px 2px 0 #000000',
                    minWidth: '250px',
                  }}
                >
                  Loading repositories...
                </div>
              )}
            </div>

            {/* Branch Selection Dropdown */}
            {selectedRepository && (
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={branchSearchTerm}
                  onChange={(e) => setBranchSearchTerm(e.target.value)}
                  onFocus={(e) => {
                    setShowBranchDropdown(true);
                    // Select all text on focus so user can start typing immediately
                    e.target.select();
                    if (branches.length === 0 && !isLoadingBranches) {
                      fetchBranches(selectedRepository);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown items
                    setTimeout(() => setShowBranchDropdown(false), 200);
                  }}
                  placeholder="Select Branch"
                  className="w-full px-2 py-2 bg-gray-100 text-black border border-gray-400 cursor-text text-base md:text-xs"
                  style={{
                    fontFamily: "monospace",
                    maxWidth: '140px',
                  }}
                />
                {showBranchDropdown && branches.length > 0 && (
                  <div
                    className="absolute top-full left-0 mt-1 bg-white border-2 border-gray-500 z-50 max-h-60 overflow-y-auto"
                    style={{
                      fontFamily: "monospace",
                      boxShadow: '2px 2px 0 #000000',
                      minWidth: '200px',
                      maxWidth: '300px',
                    }}
                  >
                    {(() => {
                      const searchLower = branchSearchTerm.toLowerCase();

                      if (!searchLower) {
                        // No search term, show all branches
                        return branches.map((branch, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedBranch(branch);
                              setBranchSearchTerm(branch);
                              setShowBranchDropdown(false);
                              onBranchChange(branch);
                            }}
                            className="px-3 py-2 cursor-pointer hover:bg-gray-200"
                          >
                            {branch}
                          </div>
                        ));
                      }

                      // With search term, show matching first, then non-matching
                      const matching = branches.filter(branch =>
                        branch.toLowerCase().includes(searchLower)
                      );
                      const nonMatching = branches.filter(branch =>
                        !branch.toLowerCase().includes(searchLower)
                      );
                      const sortedBranches = [...matching, ...nonMatching];

                      return sortedBranches.map((branch, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedBranch(branch);
                            setBranchSearchTerm(branch);
                            setShowBranchDropdown(false);
                            onBranchChange(branch);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-gray-200"
                        >
                          {branch}
                        </div>
                      ));
                    })()}
                  </div>
                )}
                {showBranchDropdown && isLoadingBranches && (
                  <div
                    className="absolute top-full left-0 mt-1 bg-white border-2 border-gray-500 z-50 px-3 py-2"
                    style={{
                      fontFamily: "monospace",
                      boxShadow: '2px 2px 0 #000000',
                      minWidth: '200px',
                    }}
                  >
                    Loading branches...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Package Icons Grid - File Browser Style */}
      <div className="flex-1 flex justify-center px-2 pb-4 min-h-0">
        <div className="w-full flex flex-col min-h-0">
          {/* Navigation bar */}
          <div
            className="bg-gray-200 border-b-2 border-gray-500 p-2 flex items-center gap-2 flex-shrink-0"
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              height: "36px",
              minHeight: "36px",
            }}
          >
            <span className="font-bold">Suggested Packages</span>
          </div>

          {/* Content area */}
          <div className="border-2 border-gray-500 border-t-0 bg-white text-black overflow-y-auto pt-4 pr-2 pb-4 pl-2 flex-1 min-h-0">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
              {packages.map((pkg, index) => (
                <PackageIcon
                  key={pkg.id}
                  name={pkg.name}
                  icon={pkg.icon}
                  onClick={() => handlePackageClick(pkg.name)}
                  priority={index < 8}
                  isSelected={selectedPackage === pkg.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
