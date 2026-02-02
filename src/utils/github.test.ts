import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubOperations } from './github.js';

// Mock execFileSync used by execGraphQL
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';

const mockExecFileSync = vi.mocked(execFileSync);

function mockGraphQL(response: any) {
  mockExecFileSync.mockReturnValueOnce(JSON.stringify(response));
}

describe('GitHubOperations', () => {
  let gh: GitHubOperations;

  beforeEach(() => {
    vi.clearAllMocks();
    gh = new GitHubOperations('/tmp');
  });

  describe('listProjects', () => {
    it('should filter out closed projects from user query', () => {
      mockGraphQL({
        data: {
          user: {
            projectsV2: {
              nodes: [
                { id: 'PVT_1', number: 1, title: 'Open Project', closed: false },
                { id: 'PVT_2', number: 2, title: 'Closed Project', closed: true },
                { id: 'PVT_3', number: 3, title: 'Another Open', closed: false },
              ],
            },
          },
        },
      });

      const projects = gh.listProjects('testuser');

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ id: 'PVT_1', number: 1, title: 'Open Project' });
      expect(projects[1]).toEqual({ id: 'PVT_3', number: 3, title: 'Another Open' });
    });

    it('should return empty when all projects are closed', () => {
      mockGraphQL({
        data: {
          user: {
            projectsV2: {
              nodes: [
                { id: 'PVT_1', number: 1, title: 'Closed', closed: true },
              ],
            },
          },
        },
      });

      const projects = gh.listProjects('testuser');
      expect(projects).toHaveLength(0);
    });

    it('should fallback to org projects when user returns no nodes', () => {
      // First call: user query returns null nodes
      mockGraphQL({ data: { user: { projectsV2: { nodes: null } } } });
      // Second call: org query
      mockGraphQL({
        data: {
          organization: {
            projectsV2: {
              nodes: [
                { id: 'PVT_ORG', number: 5, title: 'Org Project', closed: false },
                { id: 'PVT_ORG2', number: 6, title: 'Closed Org', closed: true },
              ],
            },
          },
        },
      });

      const projects = gh.listProjects('myorg');

      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual({ id: 'PVT_ORG', number: 5, title: 'Org Project' });
    });

    it('should fallback to org on user query exception', () => {
      // First call throws
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('not a user'); });
      // Org fallback
      mockGraphQL({
        data: {
          organization: {
            projectsV2: {
              nodes: [
                { id: 'PVT_ORG', number: 10, title: 'Org Proj', closed: false },
              ],
            },
          },
        },
      });

      const projects = gh.listProjects('someorg');

      expect(projects).toHaveLength(1);
      expect(projects[0].title).toBe('Org Proj');
    });
  });

  describe('getProject', () => {
    it('should return open user project', () => {
      mockGraphQL({
        data: {
          user: {
            projectV2: { id: 'PVT_1', number: 3, title: 'My Board', closed: false },
          },
        },
      });

      const project = gh.getProject('testuser', 3);

      expect(project).toEqual({ id: 'PVT_1', number: 3, title: 'My Board' });
    });

    it('should return null for closed user project (no org fallback)', () => {
      mockGraphQL({
        data: {
          user: {
            projectV2: { id: 'PVT_1', number: 3, title: 'Closed Board', closed: true },
          },
        },
      });

      const project = gh.getProject('testuser', 3);

      expect(project).toBeNull();
      // Should NOT have called org fallback (only 1 call total)
      expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    });

    it('should fallback to org when user projectV2 is null', () => {
      // User returns null
      mockGraphQL({ data: { user: { projectV2: null } } });
      // Org returns project
      mockGraphQL({
        data: {
          organization: {
            projectV2: { id: 'PVT_ORG', number: 7, title: 'Org Board', closed: false },
          },
        },
      });

      const project = gh.getProject('myorg', 7);

      expect(project).toEqual({ id: 'PVT_ORG', number: 7, title: 'Org Board' });
    });

    it('should fallback to org on user query exception', () => {
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('fail'); });
      mockGraphQL({
        data: {
          organization: {
            projectV2: { id: 'PVT_ORG', number: 2, title: 'Org Proj', closed: false },
          },
        },
      });

      const project = gh.getProject('someorg', 2);

      expect(project).toEqual({ id: 'PVT_ORG', number: 2, title: 'Org Proj' });
    });

    it('should return null when org project is closed', () => {
      // User returns null
      mockGraphQL({ data: { user: { projectV2: null } } });
      // Org returns closed
      mockGraphQL({
        data: {
          organization: {
            projectV2: { id: 'PVT_ORG', number: 7, title: 'Closed Org', closed: true },
          },
        },
      });

      const project = gh.getProject('myorg', 7);

      expect(project).toBeNull();
    });

    it('should return null when project does not exist anywhere', () => {
      // User returns null
      mockGraphQL({ data: { user: { projectV2: null } } });
      // Org returns null
      mockGraphQL({ data: { organization: { projectV2: null } } });

      const project = gh.getProject('nobody', 999);

      expect(project).toBeNull();
    });

    it('should return null when both user and org throw', () => {
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('user fail'); });
      mockExecFileSync.mockImplementationOnce(() => { throw new Error('org fail'); });

      const project = gh.getProject('fail', 1);

      expect(project).toBeNull();
    });
  });
});
