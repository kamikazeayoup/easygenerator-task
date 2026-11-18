import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { DataSource } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { CONFIG } from '../config/config.js';
import type { Config } from '../config/config.js';

export const authLoginsCollection = 'auth_logins';

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  readonly dataSource: DataSource;
  private mongoClient?: MongoClient;

  constructor(@Inject(CONFIG) private readonly config: Config) {
    try {
      this.dataSource = new DataSource({
        type: 'mongodb',
        url: config.mongoUri,
        database: config.mongoDatabase,
        entities: [User],
        synchronize: false,
        logging: false,
        extra: {
          serverSelectionTimeoutMS: 4_000,
          waitQueueTimeoutMS: 2_000,
          socketTimeoutMS: 5_000,
        },
      });
    } catch {
      throw new Error('Invalid MongoDB connection configuration.');
    }
  }

  get db() {
    if (!this.mongoClient) throw new Error('MongoDB client is unavailable.');
    return this.mongoClient.db(this.config.mongoDatabase);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.initialize();
      // Keep the configured application database even when the URI names an authentication database.
      this.dataSource.driver.database = this.config.mongoDatabase;
      // Token revocation and readiness share TypeORM's native client.
      const runner = this.dataSource.createQueryRunner();
      if (!('databaseConnection' in runner) || !(runner.databaseConnection instanceof MongoClient)) {
        throw new Error('MongoDB client is unavailable.');
      }
      this.mongoClient = runner.databaseConnection;
    } catch {
      throw new Error('Could not connect to MongoDB.');
    }

    try {
      await this.dataSource.getMongoRepository(User).createCollectionIndex({ email: 1 }, { unique: true });
      await this.db.collection(authLoginsCollection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch {
      throw new Error('Could not initialize the MongoDB indexes.');
    }
  }

  async checkReady(): Promise<void> {
    try {
      await this.db.command({ ping: 1 }, { signal: AbortSignal.timeout(2_000) });
    } catch {
      throw new ServiceUnavailableException('Database unavailable.');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}
