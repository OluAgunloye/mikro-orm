(global as any).process.env.FORCE_COLOR = 0;

import { Migrator } from '@mikro-orm/migrations';
import { MikroORM } from '@mikro-orm/core';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { CLIHelper } from '@mikro-orm/cli';
// noinspection ES6PreferShortImport
import { MigrationCommandFactory } from '../../packages/cli/src/commands/MigrationCommandFactory';
import { initORMSqlite } from '../bootstrap';

const close = jest.fn();
jest.spyOn(MikroORM.prototype, 'close').mockImplementation(close);
jest.spyOn(require('yargs'), 'showHelp').mockReturnValue('');
const down = jest.spyOn(Migrator.prototype, 'down');
down.mockResolvedValue([]);
const dumpMock = jest.spyOn(CLIHelper, 'dump');
dumpMock.mockImplementation(() => void 0);
jest.spyOn(CLIHelper, 'dumpTable').mockImplementation(() => void 0);

describe('MigrateDownCommand', () => {

  let orm: MikroORM<SqliteDriver>;

  beforeAll(async () => {
    orm = await initORMSqlite();
    const getORMMock = jest.spyOn(CLIHelper, 'getORM');
    getORMMock.mockResolvedValue(orm);
  });

  afterAll(async () => await orm.close(true));

  test('builder', async () => {
    const cmd = MigrationCommandFactory.create('down');
    const args = { option: jest.fn() };
    cmd.builder(args as any);
  });

  test('handler', async () => {
    const cmd = MigrationCommandFactory.create('down');

    await expect(cmd.handler({} as any)).resolves.toBeUndefined();
    expect(down.mock.calls.length).toBe(1);
    expect(close.mock.calls.length).toBe(1);
    await expect(cmd.handler({ only: '1,2' } as any)).resolves.toBeUndefined();
    expect(down.mock.calls.length).toBe(2);
    expect(close.mock.calls.length).toBe(2);
    await expect(cmd.handler({ from: '1', to: '2' } as any)).resolves.toBeUndefined();
    expect(down.mock.calls.length).toBe(3);
    expect(close.mock.calls.length).toBe(3);
    await expect(cmd.handler({ from: '0', to: '0' } as any)).resolves.toBeUndefined();
    expect(down.mock.calls.length).toBe(4);
    expect(close.mock.calls.length).toBe(4);
    await expect(cmd.handler('test' as any)).resolves.toBeUndefined();
    expect(down.mock.calls.length).toBe(5);
    expect(close.mock.calls.length).toBe(5);
  });

});
