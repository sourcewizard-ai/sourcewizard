import fs from 'fs';
import os from 'os';
import path from 'path';

// Installation discovery function (same as in CLI agent)
async function discoverInstallations(): Promise<any[]> {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const portFiles = files.filter((f: string) => f.startsWith('sourcewizard-progress-') && f.endsWith('.port'));
    
    if (portFiles.length === 0) {
      return [];
    }
    
    const installations: any[] = [];
    
    for (const file of portFiles) {
      try {
        const filePath = path.join(tmpDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const metadata = JSON.parse(content);
        
        installations.push({
          metadata,
          filePath,
          displayName: `Installation in ${metadata.cwd}`
        });
      } catch (parseError) {
        // Skip invalid metadata files
        continue;
      }
    }
    
    // Sort by start time (most recent first)
    return installations.sort((a, b) => b.metadata.startTime - a.metadata.startTime);
  } catch (error) {
    return [];
  }
}

// Port discovery function (same as in CLI agent)
async function discoverProgressPort(): Promise<number | null> {
  const installations = await discoverInstallations();
  
  if (installations.length === 0) {
    return null;
  }
  
  // Return the port of the most recent installation
  return installations[0].metadata.port;
}

describe('Port Discovery', () => {
  let createdFiles: string[] = [];

  beforeEach(() => {
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

  function createPortFile(port: number, pid: number, status: string = 'ready', currentPackage: string | null = null): string {
    const portFile = path.join(os.tmpdir(), `sourcewizard-progress-${pid}.port`);
    const metadata = {
      port,
      pid,
      startTime: Date.now(),
      status,
      currentPackage,
      cwd: process.cwd()
    };
    fs.writeFileSync(portFile, JSON.stringify(metadata, null, 2));
    createdFiles.push(portFile);
    return portFile;
  }

  it('should return null when no port files exist', async () => {
    const port = await discoverProgressPort();
    expect(port).toBeNull();
  });

  it('should discover a single port file', async () => {
    const testPort = 3456;
    const testPid = 12345;
    createPortFile(testPort, testPid);

    const discoveredPort = await discoverProgressPort();
    expect(discoveredPort).toBe(testPort);
  });

  it('should return the most recent port file when multiple exist', async () => {
    const oldPort = 3456;
    const newPort = 4567;
    
    createPortFile(oldPort, 12345);
    
    // Small delay to ensure different modification times
    await new Promise(resolve => setTimeout(resolve, 10));
    
    createPortFile(newPort, 67890);

    const discoveredPort = await discoverProgressPort();
    expect(discoveredPort).toBe(newPort);
  });

  it('should handle invalid port content gracefully', async () => {
    const portFile = path.join(os.tmpdir(), `sourcewizard-progress-invalid.port`);
    fs.writeFileSync(portFile, 'not-valid-json');
    createdFiles.push(portFile);

    const discoveredPort = await discoverProgressPort();
    expect(discoveredPort).toBeNull();
  });

  it('should handle file system errors gracefully', async () => {
    // Mock fs.readdirSync to throw an error
    const originalReaddir = fs.readdirSync;
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const discoveredPort = await discoverProgressPort();
    expect(discoveredPort).toBeNull();

    // Restore original function
    fs.readdirSync = originalReaddir;
  });
});