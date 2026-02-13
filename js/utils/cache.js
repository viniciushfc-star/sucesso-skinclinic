const cache = {}

export function setCache(key,data){
 cache[key] = {
  data,
  time: Date.now()
 }
}

export function getCache(key,ttl=30000){

 const item = cache[key]

 if(!item) return null

 if(Date.now() - item.time > ttl)
  return null

 return item.data
}
