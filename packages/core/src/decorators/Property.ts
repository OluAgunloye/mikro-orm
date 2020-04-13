import { MetadataStorage } from '../metadata';
import { Utils } from '../utils';
import { Cascade, EntityValidator, ReferenceType } from '../entity';
import { EntityName, EntityProperty, AnyEntity, Constructor } from '../typings';
import { Type } from '../types';

export function Property(options: PropertyOptions = {}): Function {
  return function (target: AnyEntity, propertyName: string) {
    const meta = MetadataStorage.getMetadata(target.constructor.name);
    const desc = Object.getOwnPropertyDescriptor(target, propertyName) || {};
    EntityValidator.validateSingleDecorator(meta, propertyName);
    Utils.lookupPathFromDecorator(meta);
    const name = options.name || propertyName;

    if (propertyName !== name && !(desc.value instanceof Function)) {
      Utils.renameKey(options, 'name', 'fieldName');
    }

    options.name = propertyName;
    const prop = Object.assign({ reference: ReferenceType.SCALAR }, options) as EntityProperty;
    prop.getter = !!desc.get;
    prop.setter = !!desc.set;

    if (desc.value instanceof Function) {
      prop.getter = true;
      prop.persist = false;
      prop.type = 'method';
      prop.getterName = propertyName;
      prop.name = name;
    }

    meta.properties[prop.name] = prop;
  };
}

export type PropertyOptions = {
  name?: string;
  fieldName?: string;
  fieldNames?: string[];
  customType?: Type;
  columnType?: string;
  type?: 'string' | 'number' | 'boolean' | 'bigint' | 'ObjectId' | string | object | bigint | Date | Constructor<Type>;
  length?: any;
  onCreate?: () => any;
  onUpdate?: () => any;
  default?: any;
  nullable?: boolean;
  unsigned?: boolean;
  persist?: boolean;
  hidden?: boolean;
  version?: boolean;
  index?: boolean | string;
  unique?: boolean | string;
  primary?: boolean;
  serializedPrimaryKey?: boolean;
};

export interface ReferenceOptions<T extends AnyEntity<T>> extends PropertyOptions {
  entity?: string | (() => EntityName<T>);
  cascade?: Cascade[];
  eager?: boolean;
}
