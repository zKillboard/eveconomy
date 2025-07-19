require('dotenv').config();
const { resolve6 } = require('dns').promises;

const parsed = new URL(process.env.REDIS_URL);
process.env.REDIS_HOST = parsed.hostname;
process.env.REDIS_PORT = parsed.port;
process.env.REDIS_AUTH = parsed.password;

(async () => {
  try {
    let ipv6a = await resolve6(process.env.REDIS_HOST);
    if (ipv6a.length > 0) process.env.REDIS_HOST = ipv6a[0];

    require('fundamen')('www');

  } catch (err) {
    console.error('Error', err);
  }
})();


