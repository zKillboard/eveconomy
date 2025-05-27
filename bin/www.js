require('dotenv').config();

const parsed = new URL(process.env.REDIS_URL);
const process.env.REDIS_HOST = parsed.hostname;
const process.env.REDIS_PORT = parsed.port;
const process.env.REDIS_AUTH = parsed.password;
console.log(process.env);

require('fundamen')('www');
