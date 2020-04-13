import { ObjectId } from 'mongodb';
import { inspect } from 'util';

import { EntityAssigner, EntityData, EntityHelper, MikroORM, Reference, Utils, wrap } from '@mikro-orm/core';
import { MongoDriver } from '@mikro-orm/mongodb';
import { Author, Book, BookTag, Publisher, Test } from './entities';
import { initORMMongo, wipeDatabase } from './bootstrap';
import FooBar from './entities/FooBar';
import { FooBaz } from './entities/FooBaz';

describe('EntityAssignerMongo', () => {

  let orm: MikroORM<MongoDriver>;

  beforeAll(async () => orm = await initORMMongo());
  beforeEach(async () => wipeDatabase(orm.em));

  test('#toObject() should return DTO', async () => {
    const author = new Author('Jon Snow', 'snow@wall.st');
    author.born = new Date();
    expect(author).toBeInstanceOf(Author);
    expect(wrap(author).toObject()).toBeInstanceOf(Object);
  });

  test('#toObject() should ignore properties marked with hidden flag', async () => {
    const test = Test.create('Bible');
    expect(test.hiddenField).toBeDefined();
    expect(wrap(test).toJSON().hiddenField).not.toBeDefined();
  });

  test('#toJSON() should return DTO', async () => {
    const author = new Author('Jon Snow', 'snow@wall.st');
    author.born = new Date();
    expect(author).toBeInstanceOf(Author);
    expect(author.toJSON()).toBeInstanceOf(Object);
    expect(author.toJSON()).toMatchObject({ fooBar: 123 });
    expect(author.toJSON().email).toBeUndefined();
    expect(author.toJSON(false)).toMatchObject({ fooBar: 123, email: author.email });
  });

  test('#toJSON properly calls child entity toJSON with correct params', async () => {
    const god = new Author('God', 'hello@heaven.god');
    const bible = new Book('Bible', god);
    const bible2 = new Book('Bible pt. 2', god);
    const bible3 = new Book('Bible pt. 3', new Author('Lol', 'lol@lol.lol'));
    await orm.em.persistAndFlush([bible, bible2, bible3]);
    orm.em.clear();

    const newGod = (await orm.em.findOne(Author, god.id, ['books.author']))!;

    for (const book of newGod.books) {
      expect(book.toJSON()).toMatchObject({
        author: { name: book.author.name },
      });
    }
  });

  test('#toObject complex serialization (1:m -> m:1)', async () => {
    const god = new Author('God', 'hello@heaven.god');
    const bible = new Book('Bible', god);
    god.favouriteAuthor = god;
    bible.publisher = Reference.create(new Publisher('Publisher 1'));
    await orm.em.persistAndFlush(bible);
    orm.em.clear();

    const author = (await orm.em.findOne(Author, god.id, ['favouriteAuthor', 'books.author', 'books.publisher']))!;
    const json = wrap(author).toObject();
    expect(json.termsAccepted).toBe(false);
    expect(json.favouriteAuthor).toBe(god.id); // self reference will be ignored even when explicitly populated
    expect(json.books[0]).toMatchObject({
      author: { name: bible.author.name },
      publisher: { name: (await bible.publisher.load()).name },
    });
  });

  test('#load() should populate the entity', async () => {
    const author = new Author('Jon Snow', 'snow@wall.st');
    await orm.em.persistAndFlush(author);
    orm.em.clear();

    const jon = orm.em.getReference(Author, author.id!);
    expect(wrap(jon).isInitialized()).toBe(false);
    await EntityHelper.init(jon);
    expect(wrap(jon).isInitialized()).toBe(true);
  });

  test('#load() should refresh the entity if its already loaded', async () => {
    const author = new Author('Jon Snow', 'snow@wall.st');
    await orm.em.persistAndFlush(author);
    orm.em.clear();

    const jon = await orm.em.findOne(Author, author.id);
    await orm.em.nativeUpdate(Author, { id: author.id }, { name: 'Changed!' });
    expect(jon!.name).toBe('Jon Snow');
    await EntityHelper.init(jon!);
    expect(jon!.name).toBe('Changed!');
  });

  test('#assign() should update entity values', async () => {
    const god = new Author('God', 'hello@heaven.god');
    const jon = new Author('Jon Snow', 'snow@wall.st');
    const book = new Book('Book2', jon);
    await orm.em.persistAndFlush(book);
    expect(book.title).toBe('Book2');
    expect(book.author).toBe(jon);
    EntityAssigner.assign(book, { title: 'Better Book2 1', author: god, notExisting: true });
    expect(book.author).toBe(god);
    expect((book as any).notExisting).toBe(true);
    await orm.em.persistAndFlush(god);
    EntityAssigner.assign(book, { title: 'Better Book2 2', author: god.id });
    expect(book.author).toBe(god);
    EntityAssigner.assign(book, { title: 'Better Book2 3', author: jon._id });
    expect(book.title).toBe('Better Book2 3');
    expect(book.author).toBe(jon);
  });

  test('#assign() should update entity collection', async () => {
    const other = new BookTag('other');
    await orm.em.persistAndFlush(other);
    const jon = new Author('Jon Snow', 'snow@wall.st');
    const book = new Book('Book2', jon);
    const tag1 = new BookTag('tag 1');
    const tag2 = new BookTag('tag 2');
    const tag3 = new BookTag('tag 3');
    book.tags.add(tag1);
    book.tags.add(tag2);
    book.tags.add(tag3);
    await orm.em.persistAndFlush(book);
    EntityAssigner.assign(book, { tags: [other._id] });
    expect(book.tags.getIdentifiers('_id')).toMatchObject([other._id]);
    EntityAssigner.assign(book, { tags: [] });
    expect(book.tags.getIdentifiers()).toMatchObject([]);
    EntityAssigner.assign(book, { tags: [tag1.id, tag3.id] });
    expect(book.tags.getIdentifiers('id')).toMatchObject([tag1.id, tag3.id]);
    EntityAssigner.assign(book, { tags: [tag2] });
    expect(book.tags.getIdentifiers('_id')).toMatchObject([tag2._id]);
    EntityAssigner.assign(book, { tags: [wrap(tag2).toObject()] });
    expect(book.tags.getIdentifiers('_id')).toMatchObject([tag2._id]);
    expect(book.tags.isDirty()).toBe(true);
    expect(() => EntityAssigner.assign(book, { tags: [false] } as EntityData<Book>)).toThrowError(`Invalid collection values provided for 'Book.tags' in Book.assign(): [ false ]`);
    expect(() => EntityAssigner.assign(book, { publisher: [{ foo: 'bar' }] } as EntityData<Book>)).toThrowError(`Invalid reference value provided for 'Book.publisher' in Book.assign(): [{"foo":"bar"}]`);
  });

  test('should have string id getter and setter', async () => {
    const author = new Author('Jon Snow', 'snow@wall.st');
    author._id = new ObjectId('5b0ff0619fbec620008d2414');
    expect(author.id).toBe('5b0ff0619fbec620008d2414');

    author.id = '5b0d19b28b21c648c2c8a600';
    expect(author._id).toEqual(new ObjectId('5b0d19b28b21c648c2c8a600'));

    author.id = '';
    expect(author._id).toBeNull();
  });

  test('setting m:1 reference is propagated to 1:m collection', async () => {
    const author = new Author('n', 'e');
    const book = new Book('t');
    book.author = author;
    expect(author.books.getItems()).toContain(book);
    await orm.em.persistAndFlush(book);
    orm.em.clear();

    const b = await orm.em.findOneOrFail(Book, book.id);
    expect(Utils.prepareEntity(b, orm.getMetadata(), orm.em.getDriver().getPlatform())).toEqual({
      _id: b._id,
      title: b.title,
      author: b.author._id,
    });
  });

  test('setting 1:1 reference is propagated to the inverse side', async () => {
    const bar = FooBar.create('bar');
    const baz = FooBaz.create('baz');
    bar.baz = baz;
    expect(baz.bar).toBe(bar);
    await orm.em.persistAndFlush(bar);
    orm.em.clear();

    const b = await orm.em.findOneOrFail(FooBar, bar.id);
    expect(Utils.prepareEntity(b, orm.getMetadata(), orm.em.getDriver().getPlatform())).toEqual({
      _id: b._id,
      name: b.name,
      baz: b.baz!._id,
    });
  });

  test('custom inspect shows get/set props', async () => {
    const bar = FooBar.create('bar');
    bar.baz = FooBaz.create('baz');
    let actual = inspect(bar);

    // util.inspect was buggy in node < 12 so we cannot compare the same snapshot
    if (+process.version.match(/^v(\d+\.\d+)/)![1] >= 12) {
      expect(actual).toBe('FooBar {\n' +
        "  name: 'bar',\n" +
        "  baz: FooBaz { name: 'baz', bar: FooBar { name: 'bar', baz: [FooBaz] } }\n" +
        '}');
    }

    const god = new Author('God', 'hello@heaven.god');
    const bible = new Book('Bible', god);
    god.favouriteAuthor = god;
    delete god.createdAt;
    delete god.updatedAt;
    bible.publisher = Reference.create(new Publisher('Publisher 1'));
    actual = inspect(god);

    // util.inspect was buggy in node < 12 so we cannot compare the same snapshot
    if (+process.version.match(/^v(\d+\.\d+)/)![1] >= 12) {
      expect(actual).toBe('Author {\n' +
        '  hookTest: false,\n' +
        '  termsAccepted: false,\n' +
        '  books: Collection {\n' +
        "    '0': Book {\n" +
        '      tags: [Collection],\n' +
        "      title: 'Bible',\n" +
        '      author: [Author],\n' +
        '      publisher: [Reference]\n' +
        '    },\n' +
        '    initialized: true,\n' +
        '    dirty: false\n' +
        '  },\n' +
        '  friends: Collection { initialized: true, dirty: false },\n' +
        "  name: 'God',\n" +
        "  email: 'hello@heaven.god',\n" +
        "  foo: 'bar',\n" +
        '  favouriteAuthor: Author {\n' +
        '    hookTest: false,\n' +
        '    termsAccepted: false,\n' +
        "    books: Collection { '0': [Book], initialized: true, dirty: false },\n" +
        '    friends: Collection { initialized: true, dirty: false },\n' +
        "    name: 'God',\n" +
        "    email: 'hello@heaven.god',\n" +
        "    foo: 'bar',\n" +
        '    favouriteAuthor: Author {\n' +
        '      hookTest: false,\n' +
        '      termsAccepted: false,\n' +
        '      books: [Collection],\n' +
        '      friends: [Collection],\n' +
        "      name: 'God',\n" +
        "      email: 'hello@heaven.god',\n" +
        "      foo: 'bar',\n" +
        '      favouriteAuthor: [Author]\n' +
        '    }\n' +
        '  }\n' +
        '}');
    }
  });

  afterAll(async () => orm.close(true));

});
