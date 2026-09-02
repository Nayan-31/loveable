import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_CONCURRENCY, WORK_FOLDER } from "../config/env.js"; // example : 5 , Ek time par maximum 5 file operations run karo.
import { isIgnored, runWithConcurrency, toRelativePath } from "../utils/path.util.js";
import { downloadFile, listRemoteFiles, uploadFile } from "./s3.service.js";

/** Walks the work folder, skipping ignored folders entirely. */
export async function listLocalFiles(directory = WORK_FOLDER): Promise<string[]> { //Given folder ke andar jitni allowed files hain, unki relative-path list bana ke do.
  const entries = await fs.readdir(directory, { withFileTypes: true }); // readdir() hume entries dega: package.json , app , public , node_modules , README.md . But: withFileTypes: true ki wajah se hume ye bhi pata chalega ki entry: FILE hai ya: DIRECTORY hai , Because later hum kar rahe hain: entry.isDirectory() , entry.isFile() . Why parameter directory bhi hai? Because function recursive hai. Suppose: app>src>components>Button.tsx  Pehle: listLocalFiles("/app") phir andar: listLocalFiles("/app/src") phir: listLocalFiles("/app/src/components") , So directory current folder ko represent karta hai.
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name); //Suppose: directory = /app , entry.name = package.json
    const relativePath = toRelativePath(absolutePath); //Suppose: absolutePath: /app/app/page.tsx , toRelativePath() gives: app/page.tsx , Why? Because S3 ko: /app/app/page.tsx nahi chahiye. Usko project-relative path chahiye: app/page.tsx

    if (isIgnored(relativePath)) continue; //Suppose: relativePath = node_modules/react/index.js agar isIgnored true then continue

    if (entry.isDirectory()) { //Suppose entry: app/  Then: isDirectory() = true , So ab hume andar jaana hai.
      files.push(...(await listLocalFiles(absolutePath))); //Suppose: /app --> iske andar app folder hai ar app folder uske andar page.tsx hai and layout.tsx hai . Current call: listLocalFiles("/app") app folder mila. Then: listLocalFiles("/app/app") call hoga. And inside /app/app: page.tsx and layout.tsx milenge , Returns: [  "app/page.tsx", "app/layout.tsx"] Then:files.push(...thatArray) means  files.push("app/page.tsx",  "app/layout.tsx") , Why ...? without spread files.push([ "app/page.tsx", "app/layout.tsx"]) , You'd get nested array: [[ "app/page.tsx",  "app/layout.tsx"]] , But we want:["app/page.tsx",  "app/layout.tsx"] so ... array ko open kar deta hai 
    } else if (entry.isFile()) { //Suppose: If it's a file , package.json then isFile() = true  , files.push(relativePath); files = ["package.json"]
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Seeds the pod on startup: S3 wins when the project already has files there,
 * otherwise the boilerplate in the work folder is pushed up as the first version.
 */
export async function bootstrap(): Promise<void> {  //Pod/service start hone par initial synchronization karo.
  const remoteFiles = await listRemoteFiles(); //S3 ko check karo : Ye s3.service.ts ka function hai. Question : S3 mein is project ki already koi files hain kya? Example S3: projects/abc123/ ke andar package.json , app/page.tsx , app/layout.tsx hai then : remoteFiles = ["package.json" , "app/page.tsx" , "app/layout.tsx"]

  if (remoteFiles.length > 0) { //Check S3 empty hai ya nahi agar s3 has project files 
    console.log(`[sync] restoring ${remoteFiles.length} files from S3 into ${WORK_FOLDER}`); //S3 has files → restore
    await runWithConcurrency(remoteFiles, UPLOAD_CONCURRENCY, downloadFile); //Download all remote files
    return; //Agar S3 mein files mil gayi: s3 -> download -> /app . to hum local boilerplate ko S3 mein dobara upload nahi karna chahte. so return means : Bootstrap ka kaam complete. Function yahin stop.
  }

  const localFiles = await listLocalFiles(); //What if S3 is empty? then : Local files scan karo /app -> recursive scan -> allowed files returns : ["package.json",  "app/layout.tsx",  "public/logo.svg"]
  console.log(`[sync] S3 is empty, uploading ${localFiles.length} local files`);
  await runWithConcurrency(localFiles, UPLOAD_CONCURRENCY, uploadFile);
}