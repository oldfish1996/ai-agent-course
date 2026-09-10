import { Injectable } from '@nestjs/common';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};
@Injectable()
export class UserService {
  private readonly users = new Map<string, User>([
    [
      '001',
      { id: '001', name: '赵云', email: 'zhaoyun@example.com', role: 'admin' },
    ],
    [
      '002',
      {
        id: '002',
        name: '诸葛亮',
        email: 'zhugeliang@example.com',
        role: 'manager',
      },
    ],
    [
      '003',
      { id: '003', name: '关羽', email: 'guanyu@exampble.com', role: 'user' },
    ],
    [
      '004',
      { id: '004', name: '张飞', email: 'zhangfei@exaample.com', role: 'user' },
    ],
    [
      '005',
      { id: '005', name: '刘备', email: 'liubei@exampble.com', role: 'owner' },
    ],
    [
      '006',
      {
        id: '006',
        name: '黄忠',
        email: 'huangzhong@example.com',
        role: 'user',
      },
    ],
  ]);

  findAll() {
    return Array.from(this.users.values());
  }

  findOne(id: string) {
    return this.users.get(id);
  }

  create(user: User) {
    this.users.set(user.id, user);
    return user;
  }

  remove(id: string) {
    this.users.delete(id);
  }

  update(user: User) {
    const existingUser = this.users.get(user.id);
    if (!existingUser) {
      return undefined;
    }
    const updated = {
      ...existingUser,
      ...user,
    };
    this.users.set(user.id, updated);
    return updated;
  }
}
