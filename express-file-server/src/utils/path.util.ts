import path from "node:path";
import { WORK_FOLDER } from "../config/env.js";

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/**
 * Maps an API path (always relative to WORK_FOLDER, e.g. "/app/page.tsx")
 * to an absolute path, rejecting anything escaping WORK_FOLDER.
 */
export function toAbsolutePath(requestedPath: string): string { //Suppose API sends: /src/App.tsx , We need:/app/src/App.tsx , That's its primary purpose.
  const trimmed = requestedPath.trim(); //Remove unnecessary spaces.
  if (!trimmed) throw new HttpError(400, "Empty file path"); //Empty path reject.

  const absolute = path.resolve(WORK_FOLDER, `.${path.posix.sep}${trimmed.replace(/^[/\\]+/, "")}`); //This looks scary but conceptually: "/src/App.tsx" --> "src/App.tsx" --> /app + src/App.tsx --> /app/src/App.tsx
  const relative = path.relative(WORK_FOLDER, absolute); //checks where the resolved path is relative to /app. Suppose attacker sends: ../../etc/passwd this could resolve outside /app. it's called path treversal

  if (relative.startsWith("..") || path.isAbsolute(relative)) { //Then: this rejects it. So API cannot access: /etc/passwd or: /home/user/...  outside the workspace. This is one of the most important security pieces in your entire code.
    throw new HttpError(400, `Path escapes work folder: ${requestedPath}`);
  }

  return absolute;
}

/** Converts an absolute path back to the "/app/page.tsx" style API path. */
export function toApiPath(absolutePath: string): string {
  return `/${path.relative(WORK_FOLDER, absolutePath).split(path.sep).join("/")}`; ///app/src/App.tsx --> /src/App.tsx  why? Frontend should deal with workspace-relative paths, not container-specific absolute paths.
}

export function parseFilenamesQuery(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) { //validate.
    throw new HttpError(400, "Query parameter 'filenames' is required");
  }

  const names = value
    .split(",") //Then:  .split(",") , becomes ---> [ "/src/App.tsx",  "/package.json"]
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) {
    throw new HttpError(400, "Query parameter 'filenames' is required");
  }

  return names;
}