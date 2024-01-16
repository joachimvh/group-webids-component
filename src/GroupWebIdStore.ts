import {
  AccountLoginStorage,
  BaseWebIdStore,
  createErrorMessage,
  fetchDataset,
  getLoggerFor,
  readableToQuads,
  Representation,
  ResourceIdentifier,
  SOLID,
  trimTrailingSlashes,
  VCARD
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';

// TODO:

/**
 * An extension of {@link BaseWebIdStore} that adds support for Group WebIDs.
 * The `isLinked` call now checks if the input WebID is a Group WebID if no match can be found initially.
 * The server checks if the target has a) A correct solid:oidcIssuer triple and,
 * b) A membership triple containing a WebID linked to the account.
 */
export class GroupWebIdStore extends BaseWebIdStore {
  protected readonly groupLogger = getLoggerFor(this);

  protected baseUrl: string;

  public constructor(baseUrl: string, storage: AccountLoginStorage<any>) {
    super(storage);
    this.baseUrl = baseUrl;
  }

  public async isLinked(webId: string, accountId: string): Promise<boolean> {
    if (await super.isLinked(webId, accountId)) {
      return true;
    }
    this.groupLogger.debug(`WebID ${webId} is not linked directly to account ${accountId}. Checking for group WebID`);
    return this.isValidGroupWebId(webId, accountId);
  }

  /**
   * Determine if the input WebID is a valid Group WebID.
   */
  protected async isValidGroupWebId(groupWebId: string, accountId: string): Promise<boolean> {
    const groupDocument: ResourceIdentifier = { path: /^[^#]*/u.exec(groupWebId)![0] };

    // Fetch the required vCard group file
    let representation: Representation;
    try {
      // We don't want a failed fetch to throw an error, if the target does not exist for example.
      representation = await fetchDataset(groupDocument.path);
    } catch (error: unknown) {
      this.groupLogger.debug(`Unable to dereference (group) WebID ${groupWebId}: ${createErrorMessage(error)}`);
      return false;
    }

    const quads = await readableToQuads(representation.data);
    return this.isValidGroupWebIdData(quads, groupWebId, accountId);
  }

  /**
   * Determine if the RDF dataset contains the necessary triples for a valid Group WebID.
   */
  protected async isValidGroupWebIdData(quads: Store, groupWebId: string, accountId: string): Promise<boolean> {
    const subject = DataFactory.namedNode(groupWebId);

    // Need to make sure this IDP can be used as issuer for this group WebID
    const issuers = quads.getObjects(subject, SOLID.terms.oidcIssuer, null);
    if (quads.countQuads(subject, SOLID.terms.oidcIssuer, DataFactory.namedNode(this.baseUrl), null) === 0) {
      this.groupLogger.debug(`This server is not authorized to issue tokens for group WebID ${groupWebId
      }. If it should be, you need to add the triple <${groupWebId}> <${SOLID.oidcIssuer}> <${this.baseUrl}>.`);
      return false;
    }

    // Make sure this account has at least 1 WebID in the group
    // Calling `super` instead of `this` to prevent infinite recursion
    const webIdsInGroup = quads.getObjects(subject, VCARD.terms.hasMember, null);
    const webIdLinks = await super.findLinks(accountId);
    const hasWebIdInGroup = webIdLinks.some(({ webId }): boolean =>
      webIdsInGroup.some((otherWebId): boolean => webId === otherWebId.value));
    if (!hasWebIdInGroup) {
      this.groupLogger.debug(`This account has no linked WebIDs that are part of ${groupWebId}`);
      return false;
    }
    return true;
  }
}
