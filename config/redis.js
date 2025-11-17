import Redis from 'ioredis';

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    redisClient.on('error', (err) => console.log('❌ Redis Client Error', err));
    redisClient.on('connect', () => console.log('✅ Redis Connected'));

  } catch (error) {
    console.log('⚠️  Redis connection failed, continuing without cache');
  }
};

export { redisClient, connectRedis };
