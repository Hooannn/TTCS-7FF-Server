import * as redis from 'redis';
import { RedisClientType } from 'redis';
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from '@/config';
class RedisService {
  private static instance: RedisService;
  private client: RedisClientType;

  private constructor() {
    this.client = redis.createClient({
      password: REDIS_PASSWORD,
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT ? parseInt(REDIS_PORT) : 19675,
      },
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public getClient() {
    return this.client;
  }
}
export default RedisService;
