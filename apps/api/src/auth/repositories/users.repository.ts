import { Injectable } from '@nestjs/common';
import { MongoServerError, ObjectId } from 'mongodb';
import type { MongoRepository } from 'typeorm';
import { DatabaseService } from '../../database/database.service.js';
import { User } from '../entities/user.entity.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  private get users(): MongoRepository<User> {
    return this.database.dataSource.getMongoRepository(User);
  }

  async insertIfNew({ name, email }: Pick<User, 'name' | 'email'>, passwordHash: string): Promise<boolean> {
    try {
      await this.users.insertOne({ name, email, passwordHash });
      return true;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000 && error.keyPattern?.email === 1) {
        return false;
      }
      throw error;
    }
  }

  async findCredentials(email: string): Promise<{ id: string; passwordHash: string } | null> {
    const user = await this.users.findOne({ where: { email }, select: { _id: true, passwordHash: true } });
    return user && { id: user._id.toHexString(), passwordHash: user.passwordHash };
  }

  async findPublicUser(id: string): Promise<PublicUser | null> {
    if (!ObjectId.isValid(id)) return null;
    const user = await this.users.findOne({
      where: { _id: new ObjectId(id) },
      select: { _id: true, name: true, email: true },
    });
    return user && { id: user._id.toHexString(), name: user.name, email: user.email };
  }
}
