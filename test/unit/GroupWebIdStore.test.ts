import * as css from '@solid/community-server';
import {
  AccountLoginStorage,
  BadRequestHttpError,
  BasicRepresentation,
  INTERNAL_QUADS,
  SOLID,
  VCARD
} from '@solid/community-server';
import { DataFactory } from 'n3';
import { GroupWebIdStore } from '../../src/GroupWebIdStore';
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;

const STORAGE_TYPE = 'webIdLink';

// Necessary to make `jest.spyOn` work
jest.mock('@solid/community-server', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@solid/community-server')
  };
});

describe('GroupWebIdStore', (): void => {
  const id = 'id';
  const webId = 'http://example.com/card#me';
  const fetchUrl = 'http://example.com/card';
  const accountId = 'accountId';
  const baseUrl = 'http://example.com/';
  let fetchMock: jest.SpyInstance;
  let storage: jest.Mocked<AccountLoginStorage<any>>;
  let store: GroupWebIdStore;

  beforeEach(async(): Promise<void> => {
    storage = {
      defineType: jest.fn().mockResolvedValue({}),
      createIndex: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue({ webId, accountId }),
      create: jest.fn().mockResolvedValue({ id, webId, accountId }),
      find: jest.fn().mockResolvedValue([{ id, webId, accountId }]),
      delete: jest.fn(),
    } satisfies Partial<AccountLoginStorage<any>> as any;

    fetchMock = jest.spyOn(css, 'fetchDataset');
    fetchMock.mockClear();

    store = new GroupWebIdStore(baseUrl, storage);
  });

  it('#isLinked returns true if the link is stored.', async(): Promise<void> => {
    await expect(store.isLinked(webId, accountId)).resolves.toBe(true);
    expect(storage.find).toHaveBeenCalledTimes(1);
    expect(storage.find).toHaveBeenLastCalledWith(STORAGE_TYPE, { webId, accountId });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('#isLinked rejects GroupWebIDs if the URL can not be dereferenced.', async(): Promise<void> => {
    fetchMock.mockRejectedValueOnce(new BadRequestHttpError());
    storage.find.mockResolvedValueOnce([]);
    await expect(store.isLinked(webId, accountId)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(fetchUrl);
    expect(storage.find).toHaveBeenCalledTimes(1);
  });

  it('#isLinked rejects GroupWebIDs with an invalid solid:oidcIssuer triple.', async(): Promise<void> => {
    fetchMock.mockResolvedValueOnce(new BasicRepresentation([
      quad(namedNode(webId), SOLID.terms.oidcIssuer, namedNode('http://example.com/wrong')),
    ], INTERNAL_QUADS));
    storage.find.mockResolvedValueOnce([]);
    await expect(store.isLinked(webId, accountId)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(fetchUrl);
    expect(storage.find).toHaveBeenCalledTimes(1);
  });

  it('#isLinked rejects GroupWebIDs if the account has no matching linked WebID.', async(): Promise<void> => {
    fetchMock.mockResolvedValueOnce(new BasicRepresentation([
      quad(namedNode(webId), SOLID.terms.oidcIssuer, namedNode(baseUrl)),
      quad(namedNode(webId), VCARD.terms.hasMember, namedNode('http://example.com/webID')),
    ], INTERNAL_QUADS));
    storage.find.mockResolvedValueOnce([]);
    await expect(store.isLinked(webId, accountId)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(fetchUrl);
    expect(storage.find).toHaveBeenCalledTimes(2);
  });

  it('#isLinked accepts GroupWebIDs if all expected triples are there.', async(): Promise<void> => {
    fetchMock.mockResolvedValueOnce(new BasicRepresentation([
      quad(namedNode(webId), SOLID.terms.oidcIssuer, namedNode(baseUrl)),
      quad(namedNode(webId), VCARD.terms.hasMember, namedNode('http://example.com/webID')),
    ], INTERNAL_QUADS));
    // First make sure the fetch part gets triggered
    storage.find.mockResolvedValueOnce([]);
    // Then make sure the WebID in the group is seen as linked
    storage.find.mockResolvedValueOnce([ { id: '', webId: 'http://example.com/webID' } ]);
    await expect(store.isLinked(webId, accountId)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(fetchUrl);
    expect(storage.find).toHaveBeenCalledTimes(2);
  });
});
