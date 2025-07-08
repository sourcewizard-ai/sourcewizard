import React from "react";
import { Text, useInput } from "ink";
import type { PackageInstallationDetails, PageMetadata } from "../types.js";

interface CompletionScreenProps {
  packageName: string;
  success: boolean;
  details: PackageInstallationDetails;
  onContinue: () => void;
}

export const getCompletionMetadata = (success: boolean): PageMetadata => ({
  title: `MCP Package Manager - ${success ? "Installation Complete" : "Installation Failed"}`,
  menuTitle: success ? "Installation Complete" : "Installation Failed",
  menuWidth: 70,
  borderColor: success ? "green" : "red"
});

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  packageName,
  success,
  details,
  onContinue,
}) => {
  useInput((input, key) => {
    if (key.return || input) {
      onContinue();
    }
  });

  return (
    <>
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

      {success &&
        details.installedPackages &&
        details.installedPackages.length > 0 && (
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

      {success &&
        details.createdFiles &&
        details.createdFiles.length > 0 && (
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

      {success && details.warnings && details.warnings.length > 0 && (
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
    </>
  );
}; 