import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'child_process';
import iconv from 'iconv-lite';
import os from 'os';

export interface ExecutionResult {
  output: string;
  success: boolean;
  exitCode: number | null;
}

// Normalize line endings and handle encoding
function decodeAndNormalize(data: Buffer): string {
  let str: string;
  if (os.platform() === 'win32') {
    try {
      str = iconv.decode(data, 'cp936');
    } catch {
      str = data.toString();
    }
  } else {
    str = data.toString();
  }
  return str.replace(/\r\n/g, '\n');
}

export class CommandExecutor {
  private process: ChildProcessWithoutNullStreams | null = null;

  execute(
    command: string,
    onOutput?: (data: string) => void,
    onError?: (data: string) => void
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      const options: SpawnOptionsWithoutStdio = {
        shell: true,
      };

      const proc = spawn(command, options);
      this.process = proc;

      proc.stdout.on('data', (data: Buffer) => {
        const str = decodeAndNormalize(data);
        output += str;
        onOutput?.(str);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const str = decodeAndNormalize(data);
        errorOutput += str;
        onError?.(str);
      });

      proc.on('close', (code) => {
        const fullOutput = output + errorOutput;
        resolve({
          output: fullOutput,
          success: code === 0,
          exitCode: code,
        });
        this.process = null;
      });

      proc.on('error', (err) => {
        const errMsg = `Error: ${err.message}\n`;
        errorOutput += errMsg;
        onError?.(errMsg);
      });
    });
  }

  kill(): boolean {
    if (this.process) {
      this.process.kill('SIGTERM');
      return true;
    }
    return false;
  }

  isRunning(): boolean {
    return this.process !== null;
  }
}
