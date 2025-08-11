#!/usr/bin/env tsx

import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { glob } from "glob";
import { supabase } from "../lib/supabase-client.js";

interface RegistryConfig {
  name: string;
  description: string;
  language: string;
  env?: string[];
  packages?: string[];
  tags?: string[];
  relevant_files_pattern?: string[];
  setup_prompt?: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
  };
}

interface PackageInsert {
  user_id: string;
  name: string;
  description: string;
  setup_prompt?: string;
  tags: string[];
  metadata: {
    env?: string[];
    packages?: string[];
    [key: string]: any;
  };
  relevant_files_pattern: string[];
  language: string;
  staging?: boolean;
}

async function getSessionInfo(): Promise<{
  userId: string;
  email: string;
  session: AuthSession;
} | null> {
  try {
    const configDir = path.join(os.homedir(), ".config", "sourcewizard");
    const authFilePath = path.join(configDir, "auth.json");

    // Check if auth file exists
    try {
      await fs.access(authFilePath);
    } catch {
      console.log("ℹ️  No session found in ~/.config/sourcewizard/auth.json");
      return null;
    }

    const authContent = await fs.readFile(authFilePath, "utf-8");
    const session = JSON.parse(authContent) as AuthSession;

    // Check if session is expired
    const now = Date.now();
    if (session.expiresAt && session.expiresAt < now) {
      console.warn("⚠️  Session has expired. Please log in again.");
      return null;
    }

    if (!session.user?.id || !session.user?.email) {
      console.warn("⚠️  Invalid session format. Missing user information.");
      return null;
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      session: session,
    };
  } catch (error) {
    console.error(
      "❌ Error reading session:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function readRegistryConfigs(
  registryPath: string
): Promise<RegistryConfig[]> {
  // Find all pkg.json files recursively
  const pkgFiles = await glob("**/pkg.json", {
    cwd: registryPath,
    absolute: true,
  });

  console.log(`📄 Found ${pkgFiles.length} config files`);

  const configs: RegistryConfig[] = [];

  for (const filePath of pkgFiles) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const config = JSON.parse(content) as RegistryConfig;

      // Validate required fields
      if (!config.name || !config.description || !config.language) {
        console.warn(`⚠️  Skipping ${filePath}: Missing required fields`);
        continue;
      }

      configs.push(config);
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error);
    }
  }

  return configs;
}

function mapConfigToPackage(
  config: RegistryConfig,
  userId: string,
  staging: boolean = false
): PackageInsert {
  return {
    user_id: userId,
    name: config.name,
    description: config.description,
    setup_prompt: config.setup_prompt,
    tags: config.tags || [],
    metadata: {
      env: config.env,
      packages: config.packages,
    },
    relevant_files_pattern: config.relevant_files_pattern || [],
    language: config.language,
    staging,
  };
}

async function authenticateSupabase(session: AuthSession): Promise<boolean> {
  try {
    const { error } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    if (error) {
      console.error("❌ Error setting Supabase session:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "❌ Error authenticating with Supabase:",
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

async function insertPackages(packages: PackageInsert[]) {
  console.log(`🚀 Upserting ${packages.length} packages...`);

  const insertPromises = packages.map(async (pkg) => {
    try {
      const { data, error } = await supabase
        .from("packages")
        .upsert(pkg, {
          onConflict: "user_id,name",
          ignoreDuplicates: false,
        })
        .select("name");

      if (error) {
        return { success: false, name: pkg.name, error: error.message };
      }

      return { success: true, name: pkg.name, data };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, name: pkg.name, error: errorMsg };
    }
  });

  const results = await Promise.all(insertPromises);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully processed: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed packages:`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
  }

  return { successful, failed };
}

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const registryPath =
    args.find((arg) => arg.startsWith("--registry-path="))?.split("=")[1] ||
    "registry/out";
  const dryRun = args.includes("--dry-run");
  const staging = args.includes("--staging");

  // Get user info from session
  const sessionInfo = await getSessionInfo();
  if (!sessionInfo) {
    console.error("❌ Error: No valid session found");
    console.log("\n📖 Usage:");
    console.log("  tsx scripts/insert-registry-configs.ts [options]");
    console.log("\n🔧 Options:");
    console.log(
      "  --registry-path=<path>     Path to registry directory (default: registry/out)"
    );
    console.log("  --dry-run                  Preview what would be inserted");
    console.log("  --staging                  Mark packages as staging");
    console.log("\n💡 Examples:");
    console.log("  tsx scripts/insert-registry-configs.ts");
    console.log("  tsx scripts/insert-registry-configs.ts --dry-run");
    console.log("\n🔑 Session Info:");
    console.log(
      "  Log in first to create a session in ~/.config/sourcewizard/auth.json"
    );
    process.exit(1);
  }

  const { userId, email, session: authSession } = sessionInfo;

  console.log("🎯 Registry Config Importer");
  console.log("==========================");
  console.log(`👤 User: ${email}`);
  console.log(`📁 Registry Path: ${registryPath}`);
  console.log(`🧪 Dry Run: ${dryRun ? "Yes" : "No"}`);
  console.log(`🚧 Staging: ${staging ? "Yes" : "No"}`);
  console.log("");

  try {
    // Check if registry path exists
    await fs.access(registryPath);
  } catch (error) {
    console.error(`❌ Error: Registry path "${registryPath}" does not exist`);
    process.exit(1);
  }

  // Read and parse registry configs
  const configs = await readRegistryConfigs(registryPath);

  if (configs.length === 0) {
    console.log("⚠️  No valid pkg.json files found");
    process.exit(0);
  }

  // Map configs to package format
  const packages = configs.map((config) => mapConfigToPackage(config, userId, staging));

  console.log(
    `📦 Processing ${packages.length} packages: ${packages
      .map((p) => p.name)
      .join(", ")}`
  );

  if (dryRun) {
    console.log("\n🧪 Dry run completed - no data was inserted");
    console.log("\n📄 Sample package data:");
    console.log(JSON.stringify(packages[0], null, 2));
    return;
  }

  // Authenticate with Supabase
  const authSuccess = await authenticateSupabase(authSession);
  if (!authSuccess) {
    console.error("❌ Failed to authenticate. Cannot proceed.");
    process.exit(1);
  }

  // Insert packages into Supabase
  const result = await insertPackages(packages);

  if (result.failed.length > 0) {
    process.exit(1);
  }

  console.log("\n🎉 Import completed successfully!");
}

// Run the script if executed directly
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
