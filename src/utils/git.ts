import { execSync } from 'node:child_process';

export interface GitStatus {
  hasGit: boolean;
  branch: string;
  isClean: boolean;
  stagedFiles: string[];
  unstagedFiles: string[];
}

export class GitOperations {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Check if git is available and we're in a repo
   */
  hasGit(): boolean {
    try {
      execSync('git rev-parse --show-toplevel', { cwd: this.cwd, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository root
   */
  getRepoRoot(): string | null {
    try {
      return execSync('git rev-parse --show-toplevel', { cwd: this.cwd, encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.cwd, encoding: 'utf-8' }).trim();
    } catch {
      return 'main';
    }
  }

  /**
   * Create and checkout a new branch
   */
  createBranch(branchName: string): boolean {
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: this.cwd, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get git status
   */
  getStatus(): GitStatus {
    if (!this.hasGit()) {
      return {
        hasGit: false,
        branch: 'main',
        isClean: true,
        stagedFiles: [],
        unstagedFiles: [],
      };
    }

    const branch = this.getCurrentBranch();

    let stagedFiles: string[] = [];
    let unstagedFiles: string[] = [];

    try {
      const staged = execSync('git diff --cached --name-only', { cwd: this.cwd, encoding: 'utf-8' });
      stagedFiles = staged.split('\n').filter(Boolean);
    } catch {}

    try {
      const unstaged = execSync('git diff --name-only', { cwd: this.cwd, encoding: 'utf-8' });
      unstagedFiles = unstaged.split('\n').filter(Boolean);
    } catch {}

    return {
      hasGit: true,
      branch,
      isClean: stagedFiles.length === 0 && unstagedFiles.length === 0,
      stagedFiles,
      unstagedFiles,
    };
  }

  /**
   * Stage files
   */
  stageFiles(files: string[]): boolean {
    try {
      execSync(`git add ${files.join(' ')}`, { cwd: this.cwd, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stage all changes in a directory
   */
  stageDirectory(dir: string): boolean {
    try {
      execSync(`git add "${dir}"`, { cwd: this.cwd, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a commit
   */
  commit(message: string): string | null {
    try {
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.cwd, stdio: 'pipe' });
      const hash = execSync('git rev-parse --short HEAD', { cwd: this.cwd, encoding: 'utf-8' }).trim();
      return hash;
    } catch {
      return null;
    }
  }

  /**
   * Get highest feature number from branches
   */
  getHighestBranchNumber(): number {
    try {
      const branches = execSync('git branch -a', { cwd: this.cwd, encoding: 'utf-8' });
      let highest = 0;

      for (const line of branches.split('\n')) {
        const clean = line.trim().replace(/^\*?\s+/, '').replace(/^remotes\/[^/]+\//, '');
        const match = clean.match(/^(\d+)-/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > highest) {
            highest = num;
          }
        }
      }

      return highest;
    } catch {
      return 0;
    }
  }

  /**
   * Fetch all remotes
   */
  fetchAll(): boolean {
    try {
      execSync('git fetch --all --prune', { cwd: this.cwd, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if branch name is valid feature branch (###-name)
   */
  isFeatureBranch(branch: string): boolean {
    return /^\d{3}-/.test(branch);
  }

  /**
   * Parse feature info from branch name
   */
  parseFeatureBranch(branch: string): { id: string; name: string } | null {
    const match = branch.match(/^(\d{3})-(.+)$/);
    if (!match) {
      return null;
    }
    return {
      id: match[1],
      name: match[2],
    };
  }
}
