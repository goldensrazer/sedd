import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import type {
  GitHubIssueInfo,
  GitHubOrganization,
  GitHubProjectInfo,
  GitHubFieldInfo,
  GitHubProjectItem,
} from '../types/index.js';

export class GitHubOperations {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  private exec(cmd: string): string {
    return execSync(cmd, { cwd: this.cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
  }

  private execJson<T>(cmd: string): T | null {
    try {
      const output = this.exec(cmd);
      return JSON.parse(output) as T;
    } catch {
      return null;
    }
  }

  /**
   * Check if gh CLI is installed
   */
  hasGh(): boolean {
    try {
      this.exec('gh --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get gh CLI version string
   */
  getGhVersion(): string | null {
    try {
      const output = this.exec('gh --version');
      const match = output.match(/gh version ([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    try {
      this.exec('gh auth status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get authenticated username
   */
  getUsername(): string | null {
    try {
      const output = this.exec('gh api user --jq .login');
      return output || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the 'project' scope is available
   */
  hasProjectScope(): boolean {
    try {
      const output = this.exec('gh auth status');
      return output.includes('project') || output.includes('read:project');
    } catch {
      return false;
    }
  }

  /**
   * List organizations the authenticated user belongs to
   */
  listUserOrganizations(): GitHubOrganization[] {
    try {
      const query = `query { viewer { login organizations(first: 50) { nodes { login name } } } }`;
      const output = this.exec(
        `gh api graphql -f query='${query}'`
      );
      const data = JSON.parse(output);
      const nodes: { login: string; name?: string }[] = data?.data?.viewer?.organizations?.nodes || [];
      return nodes.map((o) => ({ login: o.login, name: o.name || o.login }));
    } catch {
      return [];
    }
  }

  /**
   * Detect owner/repo from git remote
   */
  detectOwnerRepo(): { owner: string; repo: string } | null {
    try {
      const remote = this.exec('gh repo view --json owner,name');
      const parsed = JSON.parse(remote);
      return { owner: parsed.owner.login, repo: parsed.name };
    } catch {
      return null;
    }
  }

  /**
   * List projects for an owner (user or org)
   */
  listProjects(owner: string): GitHubProjectInfo[] {
    try {
      const query = `query($owner: String!, $first: Int!) {
        user(login: $owner) {
          projectsV2(first: $first) {
            nodes { id number title }
          }
        }
      }`;
      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F owner="${owner}" -F first=20`
      );
      const data = JSON.parse(output);
      const nodes = data?.data?.user?.projectsV2?.nodes;
      if (!nodes) {
        // Try as org
        return this.listOrgProjects(owner);
      }
      return nodes.map((n: any) => ({
        number: n.number,
        id: n.id,
        title: n.title,
      }));
    } catch {
      return this.listOrgProjects(owner);
    }
  }

  private listOrgProjects(owner: string): GitHubProjectInfo[] {
    try {
      const query = `query($owner: String!, $first: Int!) {
        organization(login: $owner) {
          projectsV2(first: $first) {
            nodes { id number title }
          }
        }
      }`;
      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F owner="${owner}" -F first=20`
      );
      const data = JSON.parse(output);
      const nodes = data?.data?.organization?.projectsV2?.nodes;
      if (!nodes) return [];
      return nodes.map((n: any) => ({
        number: n.number,
        id: n.id,
        title: n.title,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get fields for a project (including Status with options)
   */
  getProjectFields(projectId: string): GitHubFieldInfo[] {
    try {
      const query = `query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 50) {
              nodes {
                ... on ProjectV2Field { id name }
                ... on ProjectV2SingleSelectField {
                  id name
                  options { id name }
                }
                ... on ProjectV2IterationField { id name }
              }
            }
          }
        }
      }`;
      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F projectId="${projectId}"`
      );
      const data = JSON.parse(output);
      const nodes = data?.data?.node?.fields?.nodes;
      if (!nodes) return [];
      return nodes.map((n: any) => ({
        id: n.id,
        name: n.name,
        options: n.options,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get the Status field (single select with column options)
   */
  getStatusField(projectId: string): GitHubFieldInfo | null {
    const fields = this.getProjectFields(projectId);
    return fields.find(f => f.name === 'Status' && f.options) || null;
  }

  /**
   * List items in a project (issues on the board)
   */
  listProjectItems(owner: string, projectNumber: number): GitHubProjectItem[] {
    try {
      const query = `query($owner: String!, $number: Int!, $first: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            items(first: $first) {
              nodes {
                id
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue { name }
                }
                content {
                  ... on Issue { number title url }
                  ... on DraftIssue { title }
                }
              }
            }
          }
        }
      }`;
      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F owner="${owner}" -F number=${projectNumber} -F first=100`
      );
      const data = JSON.parse(output);
      let nodes = data?.data?.user?.projectV2?.items?.nodes;
      if (!nodes) {
        nodes = this.listOrgProjectItems(owner, projectNumber);
      }
      if (!nodes) return [];
      return nodes.map((n: any) => ({
        id: n.id,
        title: n.content?.title || '',
        status: n.fieldValueByName?.name || '',
        issueNumber: n.content?.number,
        issueUrl: n.content?.url,
      }));
    } catch {
      return [];
    }
  }

  private listOrgProjectItems(owner: string, projectNumber: number): any[] | null {
    try {
      const query = `query($owner: String!, $number: Int!, $first: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            items(first: $first) {
              nodes {
                id
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue { name }
                }
                content {
                  ... on Issue { number title url }
                  ... on DraftIssue { title }
                }
              }
            }
          }
        }
      }`;
      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F owner="${owner}" -F number=${projectNumber} -F first=100`
      );
      const data = JSON.parse(output);
      return data?.data?.organization?.projectV2?.items?.nodes || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a GitHub issue
   */
  createIssue(title: string, body: string, labels?: string[]): GitHubIssueInfo | null {
    try {
      const labelArgs = labels && labels.length > 0
        ? labels.map(l => `-l "${l}"`).join(' ')
        : '';
      const output = this.exec(
        `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" ${labelArgs} --json number,url,title,body,state,labels`
      );
      const parsed = JSON.parse(output);
      return {
        number: parsed.number,
        url: parsed.url,
        title: parsed.title,
        body: parsed.body || '',
        state: parsed.state || 'OPEN',
        labels: (parsed.labels || []).map((l: any) => l.name || l),
      };
    } catch {
      return null;
    }
  }

  /**
   * Add an issue to a project, returns the item ID
   */
  addIssueToProject(projectId: string, issueUrl: string): string | null {
    try {
      const query = `mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }`;
      // First get the issue node ID from the URL
      const issueNodeId = this.getIssueNodeId(issueUrl);
      if (!issueNodeId) return null;

      const output = this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F projectId="${projectId}" -F contentId="${issueNodeId}"`
      );
      const data = JSON.parse(output);
      return data?.data?.addProjectV2ItemById?.item?.id || null;
    } catch {
      return null;
    }
  }

  private getIssueNodeId(issueUrl: string): string | null {
    try {
      // Parse URL: https://github.com/owner/repo/issues/42
      const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (!match) return null;
      const [, owner, repo, number] = match;
      const output = this.exec(
        `gh api repos/${owner}/${repo}/issues/${number} --jq .node_id`
      );
      return output || null;
    } catch {
      return null;
    }
  }

  /**
   * Move an item to a specific column in the project
   */
  moveItem(projectId: string, itemId: string, statusFieldId: string, optionId: string): boolean {
    try {
      const query = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }) {
          projectV2Item { id }
        }
      }`;
      this.exec(
        `gh api graphql -f query='${query.replace(/\n/g, ' ')}' -F projectId="${projectId}" -F itemId="${itemId}" -F fieldId="${statusFieldId}" -F optionId="${optionId}"`
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get issue by number
   */
  getIssue(number: number): GitHubIssueInfo | null {
    try {
      const output = this.exec(
        `gh issue view ${number} --json number,url,title,body,state,labels`
      );
      const parsed = JSON.parse(output);
      return {
        number: parsed.number,
        url: parsed.url,
        title: parsed.title,
        body: parsed.body || '',
        state: parsed.state || 'OPEN',
        labels: (parsed.labels || []).map((l: any) => l.name || l),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get issue from full URL
   */
  getIssueFromUrl(url: string): GitHubIssueInfo | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (!match) return null;
    const [, owner, repo, number] = match;
    try {
      const output = this.exec(
        `gh issue view ${number} --repo ${owner}/${repo} --json number,url,title,body,state,labels`
      );
      const parsed = JSON.parse(output);
      return {
        number: parsed.number,
        url: parsed.url || url,
        title: parsed.title,
        body: parsed.body || '',
        state: parsed.state || 'OPEN',
        labels: (parsed.labels || []).map((l: any) => l.name || l),
      };
    } catch {
      return null;
    }
  }

  /**
   * Close an issue
   */
  closeIssue(number: number): boolean {
    try {
      this.exec(`gh issue close ${number}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a comment to an issue
   */
  addIssueComment(number: number, comment: string): boolean {
    try {
      this.exec(
        `gh issue comment ${number} --body "${comment.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse issue URL into components
   */
  parseIssueUrl(url: string): { owner: string; repo: string; number: number } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: parseInt(match[3]) };
  }

  /**
   * Download images referenced in issue body to local assets/ directory.
   * Rewrites markdown image links to relative paths.
   */
  downloadIssueImages(body: string, targetDir: string): string {
    const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const githubAttachments = 'github.com/user-attachments';

    const matches: { full: string; alt: string; url: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = imageRegex.exec(body)) !== null) {
      const url = m[2];
      const ext = extname(new URL(url).pathname).toLowerCase();
      if (imageExtensions.includes(ext) || url.includes(githubAttachments)) {
        matches.push({ full: m[0], alt: m[1], url });
      }
    }

    if (matches.length === 0) return body;

    const assetsDir = join(targetDir, 'assets');
    if (!existsSync(assetsDir)) {
      mkdirSync(assetsDir, { recursive: true });
    }

    let downloaded = 0;
    let result = body;

    for (let i = 0; i < matches.length; i++) {
      const { full, alt, url } = matches[i];
      const urlExt = extname(new URL(url).pathname).toLowerCase();
      const ext = imageExtensions.includes(urlExt) ? urlExt : '.png';
      const filename = `image-${String(i + 1).padStart(3, '0')}${ext}`;
      const filepath = join(assetsDir, filename);

      try {
        execSync(`curl -sL "${url}" -o "${filepath}"`, {
          cwd: this.cwd,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 30000,
        });

        if (existsSync(filepath)) {
          result = result.replace(full, `![${alt}](./assets/${filename})`);
          downloaded++;
        }
      } catch {
        // Keep original link on failure
      }
    }

    if (downloaded > 0) {
      console.log(`  ✓ Downloaded ${downloaded} image${downloaded > 1 ? 's' : ''} to assets/`);
    }

    return result;
  }
}
