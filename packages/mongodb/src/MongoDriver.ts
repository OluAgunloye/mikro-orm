import { ClientSession, ObjectId } from 'mongodb';
import {
  DatabaseDriver, EntityData, AnyEntity, FilterQuery, EntityMetadata, EntityProperty, Configuration, Utils,
  FindOneOptions, FindOptions, QueryResult, Transaction, IDatabaseDriver, EntityManager, EntityManagerType,
} from '@mikro-orm/core';
import { MongoConnection } from './MongoConnection';
import { MongoPlatform } from './MongoPlatform';
import { MongoEntityManager } from './MongoEntityManager';

export class MongoDriver extends DatabaseDriver<MongoConnection> {

  [EntityManagerType]: MongoEntityManager<this>;

  protected readonly connection = new MongoConnection(this.config);
  protected readonly platform = new MongoPlatform();

  constructor(config: Configuration) {
    super(config, ['mongodb']);
  }

  createEntityManager<D extends IDatabaseDriver = IDatabaseDriver>(useContext?: boolean): D[typeof EntityManagerType] {
    return new MongoEntityManager(this.config, this, this.metadata, useContext) as unknown as EntityManager<D>;
  }

  async find<T extends AnyEntity<T>>(entityName: string, where: FilterQuery<T>, options: FindOptions, ctx?: Transaction<ClientSession>): Promise<T[]> {
    where = this.renameFields(entityName, where);
    const res = await this.getConnection('read').find<T>(entityName, where, options.orderBy, options.limit, options.offset, options.fields, ctx);

    return res.map((r: T) => this.mapResult<T>(r, this.metadata.get(entityName))!);
  }

  async findOne<T extends AnyEntity<T>>(entityName: string, where: FilterQuery<T>, options: FindOneOptions = { populate: [], orderBy: {} }, ctx?: Transaction<ClientSession>): Promise<T | null> {
    if (Utils.isPrimaryKey(where)) {
      where = { _id: new ObjectId(where as string) } as FilterQuery<T>;
    }

    where = this.renameFields(entityName, where);
    const res = await this.getConnection('read').find<T>(entityName, where, options.orderBy, 1, undefined, options.fields, ctx);

    return this.mapResult<T>(res[0], this.metadata.get(entityName));
  }

  async count<T extends AnyEntity<T>>(entityName: string, where: FilterQuery<T>, ctx?: Transaction<ClientSession>): Promise<number> {
    where = this.renameFields(entityName, where);
    return this.getConnection('read').countDocuments(entityName, where, ctx);
  }

  async nativeInsert<T extends AnyEntity<T>>(entityName: string, data: EntityData<T>, ctx?: Transaction<ClientSession>): Promise<QueryResult> {
    data = this.renameFields(entityName, data);
    return this.getConnection('write').insertOne(entityName, data as { _id: any }, ctx);
  }

  async nativeUpdate<T extends AnyEntity<T>>(entityName: string, where: FilterQuery<T>, data: EntityData<T>, ctx?: Transaction<ClientSession>): Promise<QueryResult> {
    if (Utils.isPrimaryKey(where)) {
      where = { _id: new ObjectId(where as string) } as FilterQuery<T>;
    }

    where = this.renameFields(entityName, where);
    data = this.renameFields(entityName, data);

    return this.getConnection('write').updateMany(entityName, where as FilterQuery<T>, data as { _id: any }, ctx);
  }

  async nativeDelete<T extends AnyEntity<T>>(entityName: string, where: FilterQuery<T>, ctx?: Transaction<ClientSession>): Promise<QueryResult> {
    if (Utils.isPrimaryKey(where)) {
      where = { _id: new ObjectId(where as string) } as FilterQuery<T>;
    }

    where = this.renameFields(entityName, where);

    return this.getConnection('write').deleteMany(entityName, where, ctx);
  }

  async aggregate(entityName: string, pipeline: any[], ctx?: Transaction<ClientSession>): Promise<any[]> {
    return this.getConnection('read').aggregate(entityName, pipeline, ctx);
  }

  async createCollections(): Promise<void> {
    const promises = Object.values(this.metadata.getAll())
      .map(meta => this.getConnection('write').createCollection(meta.collection));

    await Promise.all(promises);
  }

  async dropCollections(): Promise<void> {
    const db = this.getConnection('write').getDb();
    const collections = await db.listCollections().toArray();
    const existing = collections.map(c => c.name);
    const promises = Object.values(this.metadata.getAll())
      .filter(meta => existing.includes(meta.collection))
      .map(meta => this.getConnection('write').dropCollection(meta.collection));

    await Promise.all(promises);
  }

  async ensureIndexes(): Promise<void> {
    await this.createCollections();
    const promises: Promise<string>[] = [];

    for (const meta of Object.values(this.metadata.getAll())) {
      promises.push(...this.createIndexes(meta, 'indexes'));
      promises.push(...this.createIndexes(meta, 'uniques'));

      for (const prop of Object.values(meta.properties)) {
        promises.push(...this.createPropertyIndexes(meta, prop, 'index'));
        promises.push(...this.createPropertyIndexes(meta, prop, 'unique'));
      }
    }

    await Promise.all(promises);
  }

  private createIndexes(meta: EntityMetadata, type: 'indexes' | 'uniques') {
    const promises: Promise<string>[] = [];

    meta[type].forEach(index => {
      const properties = Utils.flatten(Utils.asArray(index.properties).map(prop => meta.properties[prop].fieldNames));
      promises.push(this.getConnection('write').getCollection(meta.name).createIndex(properties, {
        name: index.name,
        unique: type === 'uniques',
        ...(index.options || {}),
      }));
    });

    return promises;
  }

  private createPropertyIndexes(meta: EntityMetadata, prop: EntityProperty, type: 'index' | 'unique') {
    if (!prop[type]) {
      return [];
    }

    return [this.getConnection('write').getCollection(meta.name).createIndex(prop.fieldNames, {
      name: (Utils.isString(prop[type]) ? prop[type] : undefined) as string,
      unique: type === 'unique',
    })];
  }

  private renameFields<T>(entityName: string, data: T): T {
    data = Object.assign({}, data); // copy first
    Utils.renameKey(data, 'id', '_id');
    const meta = this.metadata.get(entityName, false, false);

    Object.keys(data).forEach(k => {
      if (meta?.properties[k]) {
        const prop = meta.properties[k];

        if (prop.fieldNames) {
          Utils.renameKey(data, k, prop.fieldNames[0]);
        }
      }
    });

    return data;
  }

}
