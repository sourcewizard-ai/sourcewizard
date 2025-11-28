import { promises as fs, Dirent } from "fs";
import * as path from "path";
import { Target, PackageDetector } from "../package.js";

async function detectJavaFramework(currentPath: string, configFile: string): Promise<string | undefined> {
  try {
    const configPath = path.join(currentPath, configFile);
    const content = await fs.readFile(configPath, 'utf-8');
    
    if (content.includes('spring-boot')) return "spring-boot";
    if (content.includes('org.springframework')) return "spring";
    if (content.includes('quarkus')) return "quarkus";
    if (content.includes('micronaut')) return "micronaut";
    if (content.includes('vertx')) return "vertx";
    if (content.includes('dropwizard')) return "dropwizard";
  } catch {}
  
  return undefined;
}

async function extractProjectNameFromPom(currentPath: string): Promise<string> {
  try {
    const pomPath = path.join(currentPath, 'pom.xml');
    const content = await fs.readFile(pomPath, 'utf-8');
    const artifactIdMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
    if (artifactIdMatch) return artifactIdMatch[1];
  } catch {}
  
  return path.basename(currentPath);
}

async function extractProjectNameFromGradle(currentPath: string): Promise<string> {
  try {
    // Check settings.gradle first
    const settingsPath = path.join(currentPath, 'settings.gradle');
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const nameMatch = content.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
      if (nameMatch) return nameMatch[1];
    } catch {}
    
    // Check build.gradle
    const buildPath = path.join(currentPath, 'build.gradle');
    const content = await fs.readFile(buildPath, 'utf-8');
    const nameMatch = content.match(/archivesBaseName\s*=\s*['"]([^'"]+)['"]/);
    if (nameMatch) return nameMatch[1];
  } catch {}
  
  return path.basename(currentPath);
}

export const javaDetector: PackageDetector = {
  name: "Java",
  language: "java",
  configFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
  
  async detect(currentPath: string, repoRoot: string, entries: Dirent[]): Promise<Target[]> {
    const pomEntry = entries.find(e => e.name === 'pom.xml' && e.isFile());
    const gradleEntry = entries.find(e => 
      (e.name === 'build.gradle' || e.name === 'build.gradle.kts') && e.isFile()
    );
    
    if (!pomEntry && !gradleEntry) return [];
    
    try {
      const relativePath = path.relative(repoRoot, currentPath);
      const normalizedPath = relativePath === "" ? "//" : `//${relativePath}`;
      
      let targetName: string;
      let packageManager: string;
      let framework: string | undefined;
      
      if (pomEntry) {
        targetName = await extractProjectNameFromPom(currentPath);
        packageManager = "maven";
        framework = await detectJavaFramework(currentPath, 'pom.xml');
      } else {
        targetName = await extractProjectNameFromGradle(currentPath);
        packageManager = "gradle";
        framework = await detectJavaFramework(currentPath, gradleEntry!.name);
      }
      
      return [{
        id: `${normalizedPath}:${targetName}`,
        name: targetName,
        path: normalizedPath,
        language: "java",
        packageManager,
        framework
      }];
    } catch {
      return [];
    }
  },

  async generateCommands(target: Target, actionType: "build" | "dev" | "check" | "lint" | "test" | "add-package" | "remove-package", workingDir: string, additionalArgs: string[] = []): Promise<string[]> {
    const commands: string[] = [];
    const packageManager = target.packageManager || "maven";

    switch (actionType) {
      case "build":
        commands.push(packageManager === "gradle" ? "./gradlew build" : "mvn compile");
        break;
      case "dev":
        if (target.framework === "spring-boot") {
          commands.push(packageManager === "gradle" ? "./gradlew bootRun" : "mvn spring-boot:run");
        } else {
          commands.push(packageManager === "gradle" ? "./gradlew run" : "mvn exec:java");
        }
        break;
      case "check":
        commands.push(packageManager === "gradle" ? "./gradlew check" : "mvn verify");
        break;
      case "lint":
        commands.push(packageManager === "gradle" ? "./gradlew check" : "mvn verify");
        break;
      case "test":
        commands.push(packageManager === "gradle" ? "./gradlew test" : "mvn test");
        break;
      case "add-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for add-package action");
        }

        const packageName = additionalArgs[0];
        const otherArgs = additionalArgs.slice(1).filter(arg => arg !== "--dev");

        if (packageManager === "maven") {
          let command = `mvn dependency:get -Dartifact=${packageName}`;
          if (otherArgs.length > 0) command += ` ${otherArgs.join(" ")}`;
          commands.push(command);
        } else {
          // Gradle doesn't commonly support adding single packages via CLI
          // Users typically need to manually edit build.gradle
          throw new Error("Adding packages via Gradle CLI is not commonly supported. Please manually edit build.gradle file.");
        }
        break;
      case "remove-package":
        if (additionalArgs.length === 0) {
          throw new Error("Package name is required for remove-package action");
        }

        throw new Error("Manual removal required - edit pom.xml/build.gradle to remove dependencies");
    }

    return commands;
  }
};