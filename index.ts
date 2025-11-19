// Public API exports for sourcewizard package
import { MCPPackageCLI } from "./cli/cli.js";

export async function sourcewizardSetup(name: string) {
  const cli = new MCPPackageCLI();
  await cli['cliAuth'].initialize();
  await cli.doInstall(name);
}

export async function listPackages(): Promise<void> {
  const cli = new MCPPackageCLI();
  await cli['cliAuth'].initialize();
  await cli.handleListPackages();
}
