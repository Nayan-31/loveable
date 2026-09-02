import path from "node:path"

export const PORT = Number(process.env.PORT ?? 8080); //Port environment variable se lo nii mila toh 8080

export const WORK_FOLDER = path.resolve(process.env.WORK_FOLDER ?? "/app"); //Actual project files /app mein hain. so WORK_FOLDER = /app

export const IGNORED_DIRS = new Set([ //File tree banate waqt in directories ko skip karenge.
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  ".turbo",
  "coverage",
]);

export const IGNORED_FILES = new Set([ //You don't want API to expose: Especially .env
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".DS_Store",
]);