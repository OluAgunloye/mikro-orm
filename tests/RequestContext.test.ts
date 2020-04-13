import { RequestContext, MikroORM, wrap } from '@mikro-orm/core';
import { initORMMongo, wipeDatabase } from './bootstrap';
import { Author, Book } from './entities';

describe('RequestContext', () => {

  let orm: MikroORM;

  beforeAll(async () => orm = await initORMMongo());
  beforeEach(async () => wipeDatabase(orm.em));

  test('create new context', async () => {
    expect(RequestContext.getEntityManager()).toBeUndefined();
    RequestContext.create(orm.em, () => {
      const em = RequestContext.getEntityManager()!;
      expect(em).not.toBe(orm.em);
      // access UoW via property so we do not get the one from request context automatically
      // @ts-ignore
      expect(em.unitOfWork.getIdentityMap()).not.toBe(orm.em.unitOfWork.getIdentityMap());
      expect(RequestContext.currentRequestContext()).not.toBeUndefined();
    });
    expect(RequestContext.currentRequestContext()).toBeUndefined();
  });

  test('request context does not break population', async () => {
    const bible = new Book('Bible', new Author('God', 'hello@heaven.god'));
    const author = new Author('Jon Snow', 'snow@wall.st');
    author.favouriteBook = bible;
    await orm.em.persistAndFlush(author);
    orm.em.clear();

    await new Promise(resolve => {
      RequestContext.create(orm.em, async () => {
        const em = RequestContext.getEntityManager()!;
        const jon = await em.findOne(Author, author.id, ['favouriteBook']);
        expect(jon!.favouriteBook).toBeInstanceOf(Book);
        expect(wrap(jon!.favouriteBook).isInitialized()).toBe(true);
        expect(jon!.favouriteBook.title).toBe('Bible');
        resolve();
      });
    });
  });

  afterAll(async () => orm.close(true));

});
