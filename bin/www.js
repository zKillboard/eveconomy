require('dotenv').config();

const parsed = new URL(process.env.REDIS_URL);
process.env.REDIS_HOST = parsed.hostname;
process.env.REDIS_PORT = parsed.port;
process.env.REDIS_AUTH = parsed.password;
console.log(process.env);

require('fundamen')('www');
