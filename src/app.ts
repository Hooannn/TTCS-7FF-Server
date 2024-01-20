import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import multer from 'multer';
import { NODE_ENV, ORIGIN, CREDENTIALS, PORT, LOG_FORMAT } from '@config';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import RedisService from './services/redis.service';
class App {
  public app: express.Application;
  public env: string;
  public port: string | number;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;

    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeErrorHandling();
  }

  public async start() {
    try {
      await this.connectToDatabase();
      await this.connectToRedis();
      this.listen();
    } catch (error) {
      logger.error(`❌ Error while start app\n${JSON.stringify(error)}`);
    }
  }

  public getServer() {
    return this.app;
  }

  private listen() {
    const listener = this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`=================================`);
    });
    listener.on('error', (error: any) => {
      logger.error(`❌ Error while listen to port ${this.port}:\n${JSON.stringify(error)}`);
    });
  }

  private async connectToDatabase() {
    return AppDataSource.initialize();
  }

  private async connectToRedis() {
    const redis = RedisService.getInstance().getClient();
    await redis.connect();
  }

  private initializeMiddlewares() {
    const memoryStorage = multer.memoryStorage();
    const upload = multer({
      storage: memoryStorage,
    });
    this.app.use(morgan(LOG_FORMAT, { stream }));
    this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
    this.app.use(hpp());
    this.app.use(upload.array('file'));
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
