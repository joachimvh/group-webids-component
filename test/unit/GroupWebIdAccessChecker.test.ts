import * as css from '@solid/community-server';
import {
  AccessCheckerArgs,
  ACL,
  BasicRepresentation,
  INTERNAL_QUADS,
  Representation,
  VCARD
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { GroupWebIdAccessChecker } from '../../src/GroupWebIdAccessChecker';
import namedNode = DataFactory.namedNode;
import quad = DataFactory.quad;

// Necessary to make `jest.spyOn` work
jest.mock('@solid/community-server', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@solid/community-server')
  };
});

describe('GroupWebIdAccessChecker', (): void => {
  const webId = 'http://example.com/alice/profile/card#me';
  const groupId = 'http://example.com/group';
  const acl = new Store();
  acl.addQuad(namedNode('groupMatch'), ACL.terms.agentGroup, namedNode(groupId));
  acl.addQuad(namedNode('noMatch'), ACL.terms.agentGroup, namedNode('badGroup'));
  let fetchMock: jest.SpyInstance;
  let representation: Representation;
  let checker: GroupWebIdAccessChecker;

  beforeEach(async(): Promise<void> => {
    const groupQuads = [ quad(namedNode(groupId), VCARD.terms.hasMember, namedNode(webId)) ];
    representation = new BasicRepresentation(groupQuads, INTERNAL_QUADS, false);
    fetchMock = jest.spyOn(css, 'fetchDataset');
    fetchMock.mockResolvedValue(representation);
    fetchMock.mockClear();

    checker = new GroupWebIdAccessChecker();
  });

  it('can handle all requests.', async(): Promise<void> => {
    await expect(checker.canHandle(null as any)).resolves.toBeUndefined();
  });

  it('returns true if the WebID is the group.', async(): Promise<void> => {
    const input: AccessCheckerArgs = { acl, rule: namedNode('groupMatch'), credentials: { agent: { webId: groupId }}};
    await expect(checker.handle(input)).resolves.toBe(true);
  });

  it('returns true if the WebID is a valid group member.', async(): Promise<void> => {
    const input: AccessCheckerArgs = { acl, rule: namedNode('groupMatch'), credentials: { agent: { webId }}};
    await expect(checker.handle(input)).resolves.toBe(true);
  });

  it('returns false if the WebID is not a valid group member.', async(): Promise<void> => {
    const input: AccessCheckerArgs = { acl, rule: namedNode('noMatch'), credentials: { agent: { webId }}};
    await expect(checker.handle(input)).resolves.toBe(false);
  });

  it('returns false if there are no WebID credentials.', async(): Promise<void> => {
    const input: AccessCheckerArgs = { acl, rule: namedNode('groupMatch'), credentials: {}};
    await expect(checker.handle(input)).resolves.toBe(false);
  });
});
