const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redis_url = 'redis://127.0.0.1:6379';
const client = redis.createClient(redis_url);

client.hget = util.promisify(client.hget);
client.hset = util.promisify(client.hset);

const exec = mongoose.Query.prototype.exec;


const stringify = (jsonData) => JSON.stringify(jsonData);
const parse = (jsonData) => JSON.parse(jsonData);

const clearHashKey = (hash_key) => {
  const key = stringify(hash_key);
  client.del(key);
}

mongoose.Query.prototype.cache = function (options = {}) {
  this.use_cache = true;
  this.hash_key = stringify(options.key || '');
  return this;
}

mongoose.Query.prototype.exec = async function () {
  // Configurable Cache
  if (!this.use_cache) {
    return exec.apply(this, arguments);
  }

  const key = stringify(Object.assign({}, this.getQuery(), { collection: this.mongooseCollection.name }));

  // See if we have a value for 'key' in a redis
  const cache_value = await client.hget(this.hash_key, key);

  // If we do, return the cache value
  if (cache_value) {
    const doc = parse(cache_value);
    return Array.isArray(doc) ? doc.map(d => new this.model(d)) : new this.model(doc);
  }

  // Otherwise, issue the query and store the result in redis
  const result = await exec.apply(this, arguments);
  client.hset(this.hash_key, key, stringify(result), 'EX', 10);

  return result;
}

module.exports = { clearHashKey };