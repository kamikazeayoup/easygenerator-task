import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Collection, ObjectId } from 'mongodb';
import { authLoginsCollection, DatabaseService } from '../../database/database.service.js';

export interface AuthLogin {
  _id: ObjectId;
  userId: string;
  expiresAt: Date;
  refreshId: string;
}

@Injectable()
export class AuthLoginsRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(login: AuthLogin): Promise<void> {
    await this.withCollection((logins) => logins.insertOne(login));
  }

  async isActive(loginId: ObjectId, userId: string): Promise<boolean> {
    const login = await this.withCollection((logins) => logins.findOne(
      { _id: loginId, userId, expiresAt: { $gt: new Date() } },
      { projection: { _id: 1 } },
    ));
    return login !== null;
  }

  async rotateRefreshToken(login: AuthLogin, previousRefreshId: string): Promise<boolean> {
    const result = await this.withCollection((logins) => logins.updateOne({
      _id: login._id,
      userId: login.userId,
      refreshId: previousRefreshId,
      expiresAt: { $eq: login.expiresAt, $gt: new Date() },
    }, { $set: { refreshId: login.refreshId } }));
    return result.modifiedCount === 1;
  }

  async revoke(loginIds: ObjectId[]): Promise<void> {
    if (loginIds.length > 0) {
      await this.withCollection((logins) => logins.deleteMany({ _id: { $in: loginIds } }));
    }
  }

  private async withCollection<T>(operation: (logins: Collection<AuthLogin>) => Promise<T>): Promise<T> {
    try {
      return await operation(this.database.db.collection<AuthLogin>(authLoginsCollection));
    } catch {
      throw new ServiceUnavailableException('Authentication store unavailable.');
    }
  }
}
