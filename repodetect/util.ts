import { spawn } from "child_process";

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function executeCommand(command: string, cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(" ");

    const child = spawn(cmd, args, {
      cwd,
      stdio: "pipe",
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
    });

    child.on('close', (code) => {
      const result: CommandResult = {
        command,
        stdout,
        stderr,
        exitCode: code || 0
      };

      resolve(result);
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}