import { MySqlSchemaHelper } from './MySqlSchemaHelper';
import { AbstractSqlPlatform } from '@mikro-orm/knex';

export class MySqlPlatform extends AbstractSqlPlatform {

  protected readonly schemaHelper = new MySqlSchemaHelper();

}
