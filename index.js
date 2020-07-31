const got = require('got');

//maintain network connection pool with httpagent, saves ~100ms per request.
const HttpAgent = require('agentkeepalive');
const { HttpsAgent } = HttpAgent;
const agentoptions = { freeSocketTimeout: 3.6e+6, maxFreeSockets: 5000 }
const agent = { http: new HttpAgent(agentoptions), https: new HttpsAgent(agentoptions) }

const isCoolStatus = statusCode => ["2", "3"].includes(String(statusCode).slice(0, 1))
const isFulfilledStatus = statusCode => [208, 302].includes(statusCode)
const hasReachedRateLimit = statusCode => statusCode === 429;

let done = []
let fulfilled = 0;

const config = {
  startpoint: 'https://46.101.187.82/api/v1/games/ileya/start',
  phone: '',
  auth: 'Bearer '
}

async function fetchNodes(urls) {
  const start = new Date()
  const res = await Promise.all(urls.map(url => get(url)));
  done = done.concat([...new Set(res.filter(({ url, statusCode }) => console.log(url, statusCode) || isCoolStatus(statusCode)).map(({ url }) => url))])
  fulfilled += res.filter(({ statusCode }) => isFulfilledStatus(statusCode)).length
  const limit = res.find(({ statusCode }) => hasReachedRateLimit(statusCode))
  if (limit) await new Promise(resolve => setTimeout(resolve, new Date(limit.headers["X-RateLimit-Reset"] * 1000) - new Date()))
  //get new distinct paths from nodes.
  const next = [...new Set((res.map(({ body }) => body && body.paths).flat(1)).filter(url => !done.includes(url)))]
  const end = new Date() - start
  console.log(`done in ${end}ms`)
  console.log({ done, next })
  if (fulfilled >= 50 || !next.length) return console.log(`done`) //should probably do something better here.
  await fetchNodes(next)
}

fetchNodes([config.startpoint])

async function get(url) {
  return got(url, {
    agent,
    responseType: 'json',
    throwHttpErrors: false,
    https: { rejectUnauthorized: false },
    retry: false,
    headers: { Authorization: config.auth, gomoney: config.phone }
  });
}