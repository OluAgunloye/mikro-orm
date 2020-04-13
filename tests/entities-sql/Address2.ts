import { Entity, Property, OneToOne, Index } from '@mikro-orm/core';
import { Author2 } from './Author2';

@Entity()
export class Address2 {

  @OneToOne({ entity: () => Author2, primary: true, joinColumn: 'author_id', unique: 'address2_author_id_unique' })
  author: Author2;

  @Property()
  value: string;

  constructor(author: Author2, value: string) {
    this.author = author;
    this.value = value;
  }

}
