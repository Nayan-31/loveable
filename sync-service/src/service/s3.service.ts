import {
  DeleteObjectsCommand, //S3 se files delete karo
  GetObjectCommand, //S3 se file download karo
  ListObjectsV2Command, //S3 mein files ki list nikalo
  PutObjectCommand, //S3 mein file upload karo
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises"; //fs Node.js ka filesystem module hai. Isse hum local machine/container ki files ke saath kaam karte hain: read file , write file , check file , create folder , delete file , promises version use kar rahe ho, isliye: await fs.readFile(...) , await fs.writeFile(...) , await fs.stat(...) use kar sakte ho.
import path from "node:path"; //path Node.js ka path-manipulation module hai. Example: path.dirname("/app/src/App.tsx") , gives : /app/src
import { MAX_FILE_BYTES, S3_BUCKET, S3_PREFIX } from "../config/env.js";
import { s3 } from "../config/s3.js"; 
import { toAbsolutePath, isIgnored, toObjectKey, toRelativeFromKey } from "../utils/path.util.js";

/** Lists every work-folder-relative path stored under this project's prefix. */
export async function listRemoteFiles(): Promise<string[]> { //S3 mein stored files ki list lao. Return type: Promise<string[]> , Matlab async function eventually: string[] return karega , Example: [  "package.json",   "app/page.tsx",  "public/logo.svg"]
  const keys: string[] = []; //Ek empty array banaya. Initially: keys = [] , S3 se files milengi to isme add karenge. Example: keys = ["package.json", "app/page.tsx"]
  let continuationToken: string | undefined; //Ye S3 pagination ke liye hai. simple words me ,Agar S3 mein bahut saari files hain aur ek response mein sab nahi aayi, to S3 humein ek token deta hai jisse hum next batch maang sakte hain. initially , continuationToken = undefined

  do { //Ye code kam se kam ek baar zaroor chalega.
    const response = await s3.send( //AWS S3 ko request bhejo. 
      new ListObjectsV2Command({ //Hum AWS ko bol rahe hain: "Mujhe objects/files ki list do."
        Bucket: S3_BUCKET, //Kaunsa bucket?
        Prefix: S3_PREFIX, //Kaunsi project ki files? Example: projects/abc123/  So S3 se poore bucket ki files nahi la rahe. sirf projects/abc123/  ke andar wali files la rahe ho.
        ContinuationToken: continuationToken, //Agar previous request ke baad next page available hai, token bhejo. First request: undefined , Next request: some-token
      }),
    );

    for (const object of response.Contents ?? []) { //S3 response mein Contents ke andar objects milte hain. Example: [{ Key: "projects/abc123/package.json"} , {Key: "projects/abc123/app/page.tsx"}]  , Agar response.Contents undefined hua: to empty array use karo: [] , So loop crash nahi karega.
      if (!object.Key || object.Key.endsWith("/")) continue; //Agar object ke paas key hi nahi hai: skip , S3 mein folders technically real folders nahi hote. Kabhi object key aisi ho sakti hai: projects/abc123/app/  Ye folder marker hai. Actual file nahi. so agar endsWith('/') skip
      keys.push(toRelativeFromKey(object.Key)); //Suppose S3 gives: projects/abc123/app/page.tsx  ,  toRelativeFromKey(): projects/abc123/ --> remove it  and  app/page.tsx  Then : keys.push("app/page.tsx"); Eventually: keys: [ "package.json", "app/page.tsx",  "public/logo.svg" ]
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined; //Isko simple language mein: Kya S3 ne bola ki aur files baaki hain? , Case 1 : IsTruncated = false , Matlab: Sab files mil gayi. Then: continuationToken = undefined , Loop stop. Case 2 : IsTruncated = true Matlab: Aur files baaki hain. Then: continuationToken = NextContinuationToken , Next iteration us token ke saath S3 se next batch mangayegi.
  } while (continuationToken); //Jab tak token hai: continue

  return keys; //Finally files ki relative list return. ["package.json",  "app/page.tsx", "app/layout.tsx"]
}

export async function uploadFile(relativePath: string): Promise<void> {
  if (isIgnored(relativePath)) return; //Suppose: node_modules/react/index.js , isIgnored() true. Then: return , matlab : upload mat karo

  const absolutePath = toAbsolutePath(relativePath); //Input: app/page.tsx , Output: /app/app/page.tsx , Now Node filesystem actual file ko access kar sakta hai.

  let stats; 
  try {
    stats = await fs.stat(absolutePath); //fs.stat() file ke baare mein information deta hai. For example: file size , file/folder , timestamps 
  } catch {
    return; // Removed between the event and the flush. 
  }

  if (!stats.isFile()) return; //Agar: /app/app  , folder hai: isFile() = false , Then skip. Only actual files upload honge.

  if (stats.size > MAX_FILE_BYTES) {
    console.warn(`[sync] skipping ${relativePath}: ${stats.size} bytes exceeds limit`);
    return;
  }

  await s3.send( //S3 ko request bhejo.
    new PutObjectCommand({ //AWS ko bolo --> "Ye object S3 mein put/upload karo."
      Bucket: S3_BUCKET,
      Key: toObjectKey(relativePath), //Suppose: relativePath = app/page.tsx Then: projects/abc123/app/page.tsx
      Body: await fs.readFile(absolutePath), //Ye actual file ka content read karta hai. Suppose: /app/app/page.tsx  read hua. Its content: export default function Page(){ return <h1>Hello</h1> } That content becomes S3 object body.
    }),
  );
}

export async function downloadFile(relativePath: string): Promise<void> { //Now reverse operation. Input: app/page.tsx , Goal: S3 → /app/app/page.tsx
  const absolutePath = toAbsolutePath(relativePath); //Gives: /app/app/page.tsx

  const response = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: toObjectKey(relativePath) }), //Meaning: S3 se ye object do. Key: toObjectKey(relativePath)  Input: app/page.tsx  becomes: projects/abc123/app/page.tsx
  );

  if (!response.Body) return; //Agar S3 ne file body nahi di: stop

  await fs.mkdir(path.dirname(absolutePath), { recursive: true }); //Suppose: absolutePath: /app/src/components/Button.tsx , then : path.dirname(...) , gives: /app/src/components , Ye folder ensure karta hai ki exist karta ho. recursive: true matlab  Agar parent folders nahi hain: /app/src , /app/src/components , dono create kar dega.
  await fs.writeFile(absolutePath, await response.Body.transformToByteArray()); //S3 response ko bytes mein convert karo: transformToByteArray() , Then local file mein write karo: s3 -> bytes -> /app/app/page.tsx
}

export async function deleteFiles(relativePaths: string[]): Promise<void> { //Input: ["old.ts", "test.ts", "app/old-page.tsx"]
  if (relativePaths.length === 0) return; //Agar delete karne ke liye kuch nahi: return

  // DeleteObjects accepts at most 1000 keys per request.
  for (let index = 0; index < relativePaths.length; index += 1000) { // Because AWS DeleteObjects maximum 1000 objects per request accept karta hai. Suppose: 2500 files , Then batches: Batch 1 → 0-999  = 1000 , Batch 2 → 1000-1999 = 1000 , Batch 3 → 2000-2499 = 500
    const chunk = relativePaths.slice(index, index + 1000); //Example first iteration: index = 0 , Then: slice(0, 1000) , gets first 1000 files. Next: index = 1000 , Then: slice(1000, 2000) gets next 1000.

    await s3.send( //S3 ko request bhejo
      new DeleteObjectsCommand({ //Multiple objects delete karo.
        Bucket: S3_BUCKET,
        Delete: { Objects: chunk.map((relativePath) => ({ Key: toObjectKey(relativePath) })) }, //Delete configuration start. Suppose: chunk : ["app/page.tsx", "test.ts"]  map() converts: app/page.tsx --> projects/abc123/app/page.tsx ,  test.ts --> projects/abc123/test.ts  Final AWS format: objects : [ { Key: "projects/abc123/app/page.tsx" },{ Key: "projects/abc123/test.ts" } ]
      }),
    );
  }
}