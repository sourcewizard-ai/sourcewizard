export type PackageConfig = {
  name: string;
  description: string;
  language: string;
  tags: string[];
  env: string[];
  packages: string[];
  setup_prompt?: string;
  relevant_files_pattern?: string[];
  uninstall?: string;
  update?: string;
};
