import Knex from 'knex';
import { AnyEntity, EntityManager, EntityName, EntityRepository, Utils } from '@mikro-orm/core';
import { AbstractSqlDriver } from './AbstractSqlDriver';
import { QueryBuilder } from './query';
import { SqlEntityRepository } from './SqlEntityRepository';

/**
 * @inheritDoc
 */
export class SqlEntityManager<D extends AbstractSqlDriver = AbstractSqlDriver> extends EntityManager<D> {

  /**
   * Creates a QueryBuilder instance
   */
  createQueryBuilder<T extends AnyEntity<T>>(entityName: EntityName<T>, alias?: string, type?: 'read' | 'write'): QueryBuilder<T> {
    entityName = Utils.className(entityName);
    return new QueryBuilder<T>(entityName, this.getMetadata(), this.getDriver(), this.getTransactionContext(), alias, type, this);
  }

  getKnex(type?: 'read' | 'write'): Knex {
    return this.getConnection(type).getKnex();
  }

  getRepository<T extends AnyEntity<T>, U extends EntityRepository<T> = SqlEntityRepository<T>>(entityName: EntityName<T>): U {
    return super.getRepository<T, U>(entityName);
  }

}
