import fs from 'fs';
import os from 'os';
import path from 'path';

// Define types locally to avoid importing React components
interface InstallationInfo {
  id: string;
  packageName: string;
  status: 'ready' | 'installing' | 'completed' | 'error';
  startedAt: number;
  completedAt?: number;
  errorAt?: number;
  error?: string;
}

interface MCPServerMetadata {
  port: number;
  pid: number;
  startTime: number;
  cwd: string;
  installations: { [installationId: string]: InstallationInfo };
}

interface DiscoveredInstallation {
  mcpMetadata: MCPServerMetadata;
  installationInfo: InstallationInfo;
  filePath: string;
  displayName: string;
  mcpDisplayName: string;
}

// Local implementation of the discovery function
async function discoverInstallations(): Promise<DiscoveredInstallation[]> {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const portFiles = files.filter((f: string) => f.startsWith('sourcewizard-progress-') && f.endsWith('.port'));
    
    if (portFiles.length === 0) {
      return [];
    }
    
    const installations: DiscoveredInstallation[] = [];
    
    for (const file of portFiles) {
      try {
        const filePath = path.join(tmpDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const mcpMetadata: MCPServerMetadata = JSON.parse(content);
        
        const relativeDir = path.relative(process.cwd(), mcpMetadata.cwd) || '.';
        const mcpDisplayName = `MCP #${mcpMetadata.pid} (${relativeDir})`;
        
        // If no installations exist yet, show the server as ready
        if (Object.keys(mcpMetadata.installations).length === 0) {
          installations.push({
            mcpMetadata,
            installationInfo: {
              id: 'ready',
              packageName: 'Ready for installation',
              status: 'ready',
              startedAt: mcpMetadata.startTime
            },
            filePath,
            displayName: `${mcpDisplayName} - Ready for installation`,
            mcpDisplayName
          });
        } else {
          // Add each installation from this MCP server
          for (const [installationId, installationInfo] of Object.entries(mcpMetadata.installations)) {
            let statusIcon = '⚪';
            let statusText = '';
            
            switch (installationInfo.status) {
              case 'installing':
                statusIcon = '⏳';
                statusText = 'Installing';
                break;
              case 'completed':
                statusIcon = '✅';
                statusText = 'Completed';
                break;
              case 'error':
                statusIcon = '❌';
                statusText = 'Failed';
                break;
              default:
                statusIcon = '⚪';
                statusText = 'Ready';
            }
            
            const displayName = `${mcpDisplayName} - ${statusIcon} ${statusText} ${installationInfo.packageName}`;
            
            installations.push({
              mcpMetadata,
              installationInfo,
              filePath,
              displayName,
              mcpDisplayName
            });
          }
        }
      } catch (parseError) {
        // Skip invalid metadata files
        continue;
      }
    }
    
    // Sort by installation start time (most recent first)
    return installations.sort((a, b) => b.installationInfo.startedAt - a.installationInfo.startedAt);
  } catch (error) {
    return [];
  }
}

describe('Installation Selection', () => {
  let createdFiles: string[] = [];

  beforeEach(() => {
    // Reset test start time for unique timestamps
    testStartTime = Date.now();
    
    // Clean up any existing sourcewizard port files before each test
    const tmpDir = os.tmpdir();
    try {
      const files = fs.readdirSync(tmpDir);
      const portFiles = files.filter((f: string) => f.startsWith('sourcewizard-progress-') && f.endsWith('.port'));
      portFiles.forEach(file => {
        try {
          fs.unlinkSync(path.join(tmpDir, file));
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    } catch (e) {
      // Ignore if can't read temp dir
    }
  });

  afterEach(() => {
    // Clean up any created test files
    createdFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    createdFiles = [];
  });

  function createMCPServerFile(port: number, pid: number, cwd: string = '/test/project', installations: { [id: string]: InstallationInfo } = {}): string {
    const portFile = path.join(os.tmpdir(), `sourcewizard-progress-${pid}.port`);
    const metadata: MCPServerMetadata = {
      port,
      pid,
      startTime: testStartTime++,
      cwd,
      installations
    };
    fs.writeFileSync(portFile, JSON.stringify(metadata, null, 2));
    createdFiles.push(portFile);
    return portFile;
  }
  
  let testStartTime = Date.now();
  function createInstallationInfo(id: string, packageName: string, status: 'ready' | 'installing' | 'completed' | 'error'): InstallationInfo {
    const now = testStartTime++;
    return {
      id,
      packageName,
      status,
      startedAt: now,
      ...(status === 'completed' && { completedAt: now }),
      ...(status === 'error' && { errorAt: now, error: 'Test error' })
    };
  }

  it('should discover multiple installations with proper display names', async () => {
    // Create multiple MCP servers with different installation states
    createMCPServerFile(3001, 1001, '/test/project1'); // Empty server (ready)
    createMCPServerFile(3002, 1002, '/test/project2', {
      'install1': createInstallationInfo('install1', 'express', 'installing')
    });
    createMCPServerFile(3003, 1003, '/test/project3', {
      'install2': createInstallationInfo('install2', 'react', 'completed')
    });
    createMCPServerFile(3004, 1004, '/test/project4', {
      'install3': createInstallationInfo('install3', 'typescript', 'error')
    });

    const installations = await discoverInstallations();

    expect(installations).toHaveLength(4);
    
    // Sort installations by display name for consistent validation
    const sortedInstallations = installations.sort((a, b) => a.displayName.localeCompare(b.displayName));
    
    // Check display names are formatted correctly based on status
    expect(sortedInstallations.some(i => i.displayName.includes('❌ Failed typescript'))).toBe(true);
    expect(sortedInstallations.some(i => i.displayName.includes('✅ Completed react'))).toBe(true);
    expect(sortedInstallations.some(i => i.displayName.includes('⏳ Installing express'))).toBe(true);
    expect(sortedInstallations.some(i => i.displayName.includes('Ready for installation'))).toBe(true);
  });

  it('should handle installations in different directories', async () => {
    createMCPServerFile(3001, 1001, '/home/user/project-a', {
      'install1': createInstallationInfo('install1', 'lodash', 'installing')
    });
    createMCPServerFile(3002, 1002, '/home/user/project-b/subdir'); // Empty server

    const installations = await discoverInstallations();

    expect(installations).toHaveLength(2);
    // Check that both installations are present with correct directory info
    expect(installations.some(i => i.displayName.includes('⏳ Installing lodash'))).toBe(true);
    expect(installations.some(i => i.displayName.includes('Ready for installation'))).toBe(true);
  });

  it('should skip invalid installation files', async () => {
    // Create a valid MCP server
    createMCPServerFile(3001, 1001, '/test/project');
    
    // Create an invalid file
    const invalidFile = path.join(os.tmpdir(), 'sourcewizard-progress-invalid.port');
    fs.writeFileSync(invalidFile, 'invalid json content');
    createdFiles.push(invalidFile);

    const installations = await discoverInstallations();

    // Should only return the valid installation
    expect(installations).toHaveLength(1);
    expect(installations[0].mcpMetadata.port).toBe(3001);
  });

  it('should return empty array when no installations exist', async () => {
    const installations = await discoverInstallations();
    expect(installations).toHaveLength(0);
  });

  it('should handle multiple installations on the same MCP server', async () => {
    // Create one MCP server with multiple installations
    const installations = {
      'install1': createInstallationInfo('install1', 'express', 'installing'),
      'install2': createInstallationInfo('install2', 'react', 'completed'),
      'install3': createInstallationInfo('install3', 'typescript', 'error')
    };
    
    createMCPServerFile(3001, 1001, '/test/project', installations);

    const discovered = await discoverInstallations();

    // Should return 3 installations (one for each tool) from the same MCP server
    expect(discovered).toHaveLength(3);
    
    // All should have the same MCP metadata but different installation info
    expect(discovered[0].mcpMetadata.port).toBe(3001);
    expect(discovered[1].mcpMetadata.port).toBe(3001);
    expect(discovered[2].mcpMetadata.port).toBe(3001);
    
    // Check that we have all three installation types
    const displayNames = discovered.map(d => d.displayName);
    expect(displayNames.some(name => name.includes('⏳ Installing express'))).toBe(true);
    expect(displayNames.some(name => name.includes('✅ Completed react'))).toBe(true);
    expect(displayNames.some(name => name.includes('❌ Failed typescript'))).toBe(true);
    
    // All should show the same MCP server info
    expect(displayNames.every(name => name.includes('MCP #1001'))).toBe(true);
  });
});