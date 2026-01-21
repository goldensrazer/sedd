import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface VersionInfo {
  current: string;
  latest: string;
  needsUpdate: boolean;
}

export async function checkForUpdates(): Promise<VersionInfo | null> {
  try {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const current = pkg.version;

    const latest = execSync('npm view sedd version', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const needsUpdate = current !== latest;

    return { current, latest, needsUpdate };
  } catch {
    return null;
  }
}

export function showUpdateNotification(info: VersionInfo): void {
  if (!info.needsUpdate) return;

  const currentPad = info.current.padEnd(6);
  const latestPad = info.latest.padEnd(6);

  console.log();
  console.log(chalk.yellow('╭─────────────────────────────────────────────────────╮'));
  console.log(chalk.yellow('│') + chalk.white('  📦 Nova versão do SEDD disponível!                ') + chalk.yellow('│'));
  console.log(chalk.yellow('│') + chalk.gray(`     Atual: ${currentPad} → Nova: ${latestPad}`) + '               ' + chalk.yellow('│'));
  console.log(chalk.yellow('│') + chalk.cyan('     npm install -g sedd@latest') + '                    ' + chalk.yellow('│'));
  console.log(chalk.yellow('│') + chalk.gray('     Depois execute: sedd update') + '                   ' + chalk.yellow('│'));
  console.log(chalk.yellow('╰─────────────────────────────────────────────────────╯'));
  console.log();
}

export function getInstalledVersion(): string {
  try {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}
