//Ye code basically “idle preview cleanup system” hai

//User ke preview app par agar 10 minutes tak koi request nahi aati, toh Redis key
//expire hoti hai → Redis event bhejta hai → ye code identify karta hai ki kaunsa
//preview idle hai → Kubernetes ka Pod + Service delete kar deta hai.

//Iska main purpose hai unused preview environments ko automatically destroy karke resources/cost bachana.

import {redis , redisSubscriber} from "../config/redis.js"
import { Project } from "../models/project.model.js"
import { deletePod , deleteService } from "./kubernetes.service.js"

const ACTIVITY_KEY_PREFIX = "preview:active:"
const REAP_LOCK_PREFIX = "preview:reaping:"
const ACTIVITY_CHANNEL = "preview:activity:"
const REAPED_CHANNEL = "preview:reaped"
const IDLE_TTL_MS = Number(process.env.PREVIEW_IDLE_TTL_MS || 2 * 60 * 1000)


//local handlers array ye basically functions ka array hai matlab jab koi preview delete hoga ye saare handlers execute honge [handler1 , handler2 , handler3]

const reapedHandlers: Array<(uniqueId: string)=> void> = []

export function onPreviewReaped(handler: (uniqueId: string)=> void){
    reapedHandlers.push(handler)
}

export async function recordActivity(uniqueId : string){ //ye function ke har proxied request par call hota hai 
   try {
       await redis
        .multi()
        .set(
            `${ACTIVITY_KEY_PREFIX}${uniqueId}`,
            Date.now().toString(),
            "PX",
            IDLE_TTL_MS
        ) 
        .publish(ACTIVITY_CHANNEL, uniqueId)
        .exec()
   } catch (error) {
      console.error(
        `[idle-repear] failed to record activity for ${uniqueId}`
      )
   }
}

export async function stopTracking(uniqueId: string){
    await redis.del(`${ACTIVITY_KEY_PREFIX}${uniqueId}`)
}

//actual cleanUP

async function reap(uniqueId : string){ //reap : Jo cheez ab useful nahi hai, usko clean/delete karne wala.
    const acquired = await redis.set(
        `${REAP_LOCK_PREFIX}${uniqueId}`,
         "1",
         "EX", //Lock automatically 60 seconds baad expire ho jayega.
         60,
         "NX" //Only set this key if it does NOT already exist.
    )  
    
    if(!acquired){ //Kisi aur replica ne already cleanup start kar diya hai, main kuch nahi karunga.
        return
    }

    console.log(
        `[idle-reaper] preview ${uniqueId} is idle , tearing down`
    )

   try {
     await deleteService(`nextjs-service-${uniqueId}`)

     await deletePod(`nextjs-pod-${uniqueId}`)

      await Project.updateOne(
            { runtimeId: uniqueId },
            {
                $set: { status: "created" },
                $unset: { runtimeId: 1, previewUrl: 1 }
            }
        )

     await redis.publish(REAPED_CHANNEL , uniqueId)

   } catch (error) {
     console.error(
        `[idle-reaper] failed to tear down ${uniqueId}:`,
        error
     )

     await redis.del(`${REAP_LOCK_PREFIX}${uniqueId}`)
   }
}

export async function startIdleReaper() {
    const db = redis.options.db ?? 0
    const expiredChannel = `__keyevent@${db}__:expired`

    try {
        // Redis does not emit expiry events unless keyspace notifications are enabled.
        const [, current] = await redis.config("GET", "notify-keyspace-events") as [string, string]
        if (!current.includes("E") || !current.includes("x")) {
            await redis.config("SET", "notify-keyspace-events", `${current}Ex`)
        }
    } catch (error) {
        console.warn("[idle-reaper] could not enable keyspace notifications, enable 'Ex' on the server:", error)
    }

    await redisSubscriber.subscribe(expiredChannel, REAPED_CHANNEL)

    redisSubscriber.on("message", (channel, message) => {
        if (channel === expiredChannel && message.startsWith(ACTIVITY_KEY_PREFIX)) {
            void reap(message.slice(ACTIVITY_KEY_PREFIX.length))
            return
        }

        if (channel === REAPED_CHANNEL) {
            reapedHandlers.forEach((handler) => handler(message))
        }
    })

    console.log(`[idle-reaper] listening on ${expiredChannel} (idle ttl ${IDLE_TTL_MS}ms)`)
}
