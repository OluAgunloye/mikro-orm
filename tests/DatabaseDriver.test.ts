import { Configuration, Connection, DatabaseDriver, EntityData, EntityManager, FilterQuery, FindOneOptions, FindOptions, LockMode, QueryResult, Transaction } from '@mikro-orm/core';

class Driver extends DatabaseDriver<Connection> {

  constructor(protected readonly config: Configuration,
              protected readonly dependencies: string[]) {
    super(config, dependencies);
  }

  async count<T>(entityName: string, where: FilterQuery<T>, ctx: Transaction | undefined): Promise<number> {
    return Promise.resolve(0);
  }

  async find<T>(entityName: string, where: FilterQuery<T>, options: FindOptions | undefined, ctx: Transaction | undefined): Promise<T[]> {
    return Promise.resolve([]);
  }

  async findOne<T>(entityName: string, where: FilterQuery<T>, options: FindOneOptions | undefined, ctx: Transaction | undefined): Promise<T | null> {
    return null;
  }

  async nativeDelete<T>(entityName: string, where: FilterQuery<T>, ctx: Transaction | undefined): Promise<QueryResult> {
    return { affectedRows: 0, insertId: 0 };
  }

  async nativeInsert<T>(entityName: string, data: EntityData<T>, ctx: Transaction | undefined): Promise<QueryResult> {
    return { affectedRows: 0, insertId: 0 };
  }

  async nativeUpdate<T>(entityName: string, where: FilterQuery<T>, data: EntityData<T>, ctx: Transaction | undefined): Promise<QueryResult> {
    return { affectedRows: 0, insertId: 0 };
  }

}

describe('DatabaseDriver', () => {

  test('should load entities', async () => {
    const config = new Configuration({} as any, false);
    const driver = new Driver(config, []);
    expect(driver.createEntityManager()).toBeInstanceOf(EntityManager);
    await expect(driver.aggregate('', [])).rejects.toThrowError('Aggregations are not supported by Driver driver');
    await expect(driver.lockPessimistic({}, LockMode.NONE)).rejects.toThrowError('Pessimistic locks are not supported by Driver driver');
  });

});
