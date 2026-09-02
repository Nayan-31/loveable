import {Redis} from 'ioredis'

const REDIS_URL = process.env.REDIS_URL!

export const redis = new Redis(REDIS_URL)

export const redisSubscriber = new Redis(REDIS_URL)

redis.on("error" , (err) => console.error("[redis] client error:" , err.message))

redisSubscriber.on("error", (err) => console.error("[redis] subscriber error:" , err.message))

redis.once("ready" , ()=>{
    console.log("[redis] client connected")
})

redisSubscriber.once("ready" , ()=>{
    console.log("[redis] subscriber connected")
})
