export interface LoadRootEnvOptions {
  /** repo root to read from; found by walking up to the workspaces root by default */
  root?: string;
  /** which `.env.<nodeEnv>` files to look for; `process.env.NODE_ENV` by default */
  nodeEnv?: string;
  /** re-read the files even if a previous call was memoised */
  force?: boolean;
  /** let the files win over values already in `process.env` (off by default) */
  override?: boolean;
}

export interface LoadRootEnvResult {
  /** the repo root, or `null` when running outside a checkout */
  root: string | null;
  /** absolute paths of the env files that existed, most specific first */
  files: string[];
  /** every key the cascade defined, whether or not it was applied */
  parsed: Record<string, string>;
  /** the keys actually written to `process.env` - the rest were already set */
  applied: string[];
}

export declare function loadRootEnv(options?: LoadRootEnvOptions): LoadRootEnvResult;
export declare function findRepoRoot(startDir: string): string | null;
export declare function resetRootEnvCache(): void;

declare const _default: {
  loadRootEnv: typeof loadRootEnv;
  findRepoRoot: typeof findRepoRoot;
  resetRootEnvCache: typeof resetRootEnvCache;
};
export default _default;
