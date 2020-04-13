import { unlinkSync } from 'fs';
import { Entity, MikroORM, PrimaryKey, Property, ReflectMetadataProvider, Type } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { SchemaGenerator } from '@mikro-orm/knex';

class MyType extends Type {

  convertToDatabaseValue(jsValue: string): number {
    return Number.parseInt(jsValue);
  }

  convertToJSValue(dbValue: number): string {
    return dbValue.toString();
  }

  getColumnType() {
    return 'integer';
  }

}

@Entity()
class A {

  @PrimaryKey()
  id!: number;

  @Property({ type: MyType })
  prop!: string;

}

describe('GH issue 435', () => {

  let orm: MikroORM<SqliteDriver>;

  beforeAll(async () => {
    orm = await MikroORM.init({
      entities: [A],
      dbName: `mikro_orm_test_gh_435.db`,
      debug: false,
      highlight: false,
      type: 'sqlite',
      metadataProvider: ReflectMetadataProvider,
      cache: { enabled: false },
    });
    await new SchemaGenerator(orm.em).ensureDatabase();
    await new SchemaGenerator(orm.em).dropSchema();
    await new SchemaGenerator(orm.em).createSchema();
  });

  afterAll(async () => {
    await orm.close(true);
    unlinkSync(orm.config.get('dbName')!);
  });

  test(`custom type methods are called with correct values`, async () => {
    const convertToDatabaseValueSpy = jest.spyOn(MyType.prototype, 'convertToDatabaseValue');
    const convertToJSValueSpy = jest.spyOn(MyType.prototype, 'convertToJSValue');

    const a1 = new A();
    a1.prop = '123';

    expect(convertToDatabaseValueSpy).toBeCalledTimes(0);
    expect(convertToJSValueSpy).toBeCalledTimes(0);

    await orm.em.persistAndFlush(a1);
    orm.em.clear();

    expect(convertToDatabaseValueSpy.mock.calls[0][0]).toBe('123');
    expect(convertToJSValueSpy).toBeCalledTimes(0); // so far nothing fetched from db

    const a2 = await orm.em.findOneOrFail(A, a1.id);
    expect(a2.prop).toBe('123');

    expect(convertToDatabaseValueSpy.mock.calls[0][0]).toBe('123');
    expect(convertToJSValueSpy.mock.calls[0][0]).toBe(123);
  });

});
