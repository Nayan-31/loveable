import chokidar from "chokidar";
import {
  FLUSH_DEBOUNCE_MS,
  FLUSH_MAX_WAIT_MS,
  MAX_PENDING_CHANGES,
  UPLOAD_CONCURRENCY,
  WORK_FOLDER,
} from "../config/env.js";
import { isIgnored, runWithConcurrency, toRelativePath } from "../utils/path.util.js";
import { deleteFiles, uploadFile } from "./s3.service.js";

type ChangeKind = "upsert" | "delete";

const pending = new Map<string, ChangeKind>();

let debounceTimer: NodeJS.Timeout | undefined;
let maxWaitTimer: NodeJS.Timeout | undefined;
let flushing = false;

function queue(relativePath: string, kind: ChangeKind) { //Jab Chokidar ko change milta hai, ye function call hota hai.
  if (!relativePath || isIgnored(relativePath)) return;

  if (pending.size >= MAX_PENDING_CHANGES && !pending.has(relativePath)) { //Agar queue full ho gayi:Aur changes mat daal so new changes stop kar diye
    console.warn(`[sync] pending queue full, dropping ${relativePath}`);
    return;
  }

  pending.set(relativePath, kind); //example : page.tsx -> upsert
  scheduleFlush(); //matlab Ab changes ko thodi der baad S3 bhejne ka timer lagao.
}

/**
 * Debounces bursts of writes (installs, builds, multi-file edits) and still
 * guarantees a flush every FLUSH_MAX_WAIT_MS so continuous churn is not starved.
 */
function scheduleFlush() { //ye debouncing karta hai
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS); //Agar already timer laga hua hai then : example --> 1000ms matlab : Last change ke 1 second baad flush() karo. why ? --> Har change par S3 upload nahi karna. instead: 4 changes -> wait -> 1 batch -> s3

  if (!maxWaitTimer) { //Ye safety timer hai. Agar continuously changes aa rahe hain: to debounce timer baar-baar reset hota rahega. S3 sync kabhi ho hi nahi sakta. isliye : maximum 5 sec ke andar flush kar do 
    maxWaitTimer = setTimeout(flush, FLUSH_MAX_WAIT_MS);
  }
}

function clearTimers() { //Dono timers ko cancel karta hai. matlab timer reset 
  if (debounceTimer) clearTimeout(debounceTimer);
  if (maxWaitTimer) clearTimeout(maxWaitTimer);
  debounceTimer = undefined;
  maxWaitTimer = undefined;
}

async function flush(): Promise<void> { //Queue mein jo changes collect hue hain, unko S3 mein apply karo.
  if (flushing) {
    scheduleFlush();
    return;
  }

  clearTimers();

  if (pending.size === 0) return;

  const batch = [...pending.entries()];
  pending.clear();
  flushing = true;

  const uploads = batch.filter(([, kind]) => kind === "upsert").map(([relativePath]) => relativePath);
  const removals = batch.filter(([, kind]) => kind === "delete").map(([relativePath]) => relativePath);

  try {
    await runWithConcurrency(uploads, UPLOAD_CONCURRENCY, uploadFile);
    await deleteFiles(removals);
    console.log(`[sync] flushed ${uploads.length} uploads, ${removals.length} deletes`);
  } catch (error) {
    console.error("[sync] flush failed", error);
  } finally {
    flushing = false;
    if (pending.size > 0) scheduleFlush();
  }
}

export function startWatcher() {
  const watcher = chokidar.watch(WORK_FOLDER, {
    ignoreInitial: true,
    followSymlinks: false,
    // Waits for a file to stop growing so partial writes are never uploaded.
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    ignored: (absolutePath: string) => isIgnored(toRelativePath(absolutePath)),
  });

  watcher.on("add", (absolutePath) => queue(toRelativePath(absolutePath), "upsert"));
  watcher.on("change", (absolutePath) => queue(toRelativePath(absolutePath), "upsert"));
  watcher.on("unlink", (absolutePath) => queue(toRelativePath(absolutePath), "delete"));
  watcher.on("error", (error) => console.error("[sync] watcher error", error));

  watcher.on("ready", () => {
    const watched = watcher.getWatched();
    const directories = Object.keys(watched);
    const fileCount = directories.reduce((total, dir) => total + (watched[dir]?.length ?? 0), 0);

    console.log(`[sync] watching ${directories.length} folders / ${fileCount} entries under ${WORK_FOLDER}`);
    console.log(`[sync] watched folders: ${directories.map((dir) => toRelativePath(dir) || ".").join(", ")}`);
  });

  return watcher;
}