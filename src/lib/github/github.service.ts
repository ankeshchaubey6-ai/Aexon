// src/lib/github/github.service.ts
interface CreateRepoPayload {
  name: string;
  private?: boolean;
}

export const GithubService = {
  async createRepository(payload: CreateRepoPayload) {
    return {
      success: true,
      repoName: payload.name,
      private: payload.private ?? true,
    };
  },

  async pushFiles(
    repoName: string,
    files: { path: string; content: string }[]
  ) {
    return {
      success: true,
      repoName,
      filesPushed: files.length,
    };
  },
};