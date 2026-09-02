import fs from "node:fs/promises";
import path from "node:path";
import { IGNORED_DIRS, IGNORED_FILES, WORK_FOLDER } from "../config/env.js";
import { HttpError, toAbsolutePath, toApiPath } from "../utils/path.util.js";

export async function getFileTree(): Promise<string[]> { //Returns: string[]  Example: ["/package.json","/src/App.tsx","/src/main.tsx"]
  const files: string[] = [];

  async function walk(dir: string): Promise<void> { //Recursive walk() : Directory ko recursively traverse karega. example : start from /app , then /app/src , then /app/src/components

    const entries = await fs.readdir(dir, { withFileTypes: true }); //Directory ke andar files/folders get.  withFileTypes: true means har entry ke paas information hogi:

    for (const entry of entries) {
      const absolute = path.join(dir, entry.name); //example : dir = /app/src , entry.name = App.tsx , result : /app/src/App.tsx

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue; //Ignored folder → skip.
        await walk(absolute); //recursive call
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue;
        files.push(toApiPath(absolute));
      }
    }
  }

  await walk(WORK_FOLDER);
  return files.sort();
}

export async function readFiles(filenames: string[]): Promise<Record<string, string>> { //Example: [ "/src/App.tsx",  "/package.json"]
  const contents: Record<string, string> = {}; // result : {  "/src/App.tsx": "...",  "/package.json": "..."}

  await Promise.all( //Multiple files parallel read ho rahe hain.
    filenames.map(async (filename) => {
      const absolute = toAbsolutePath(filename); //API path: /src/App.tsx ---> becomes: /app/src/App.tsx
      try {
        contents[filename] = await fs.readFile(absolute, "utf8"); //Actual content read. Why utf8? ---> Because source code text hai. Without encoding Node Buffer return kar sakta hai. with utf8 you get string 
      } catch {
        throw new HttpError(404, `File not found: ${filename}`);
      }
    }),
  );

  return contents;
}

export async function writeFiles(payload: Record<string, string>): Promise<string[]> {
  const entries = Object.entries(payload); // input : {  "/src/App.tsx": "hello","/src/main.tsx": "world"  } becomes conceptually: [["/src/App.tsx", "hello"],["/src/main.tsx", "world"]]

  if (entries.length === 0) {
    throw new HttpError(400, "Request body must contain at least one file");
  }

  await Promise.all(
    entries.map(async ([filename, content]) => {
      if (typeof content !== "string") {
        throw new HttpError(400, `Content for ${filename} must be a string`);
      }
      const absolute = toAbsolutePath(filename);
      await fs.mkdir(path.dirname(absolute), { recursive: true }); //Suppose user creates: /src/components/Button.tsx , but: /app/src/components doesn't exist , recursive: true creates the directory structure.
      await fs.writeFile(absolute, content, "utf8"); //Then: Creates or overwrites file.
    }),
  );

  return entries.map(([filename]) => filename);
}

export async function deleteFiles(filenames: string[]): Promise<string[]> {
  await Promise.all(
    filenames.map(async (filename) => {
      const absolute = toAbsolutePath(filename);
      try {
        await fs.rm(absolute, { recursive: true, force: false }); //Deletes file/directory. recursive: true means directory ke andar content bhi remove kar sakta hai. force: false means nonexistent path should cause an error.
      } catch {
        throw new HttpError(404, `File not found: ${filename}`);
      }
    }),
  );

  return filenames;
}