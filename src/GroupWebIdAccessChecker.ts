import {
  AccessChecker,
  AccessCheckerArgs,
  ACL,
  fetchDataset,
  promiseSome,
  readableToQuads,
  ResourceIdentifier,
  VCARD
} from '@solid/community-server';
import type { Store, Term } from 'n3';

/**
 * Checks if the given WebID belongs to a group that has access.
 * Implements the behaviour of groups from the WAC specification.
 *
 * This version also returns true if the credentials are using the object of the group triple,
 * as it could be a Group WebID.
 */
export class GroupWebIdAccessChecker extends AccessChecker {
  public constructor() {
    super();
  }

  public async handle({ acl, rule, credentials }: AccessCheckerArgs): Promise<boolean> {
    if (typeof credentials.agent?.webId === 'string') {
      const { webId } = credentials.agent;
      const groups = acl.getObjects(rule, ACL.terms.agentGroup, null);

      // This is new compared to AgentGroupAccessChecker.
      // In case the group WebID was used, this indicates the agent is part of the group.
      if (typeof credentials.agent?.webId === 'string' &&
        groups.some((group): boolean => group.value === credentials.agent?.webId)) {
        return true;
      }

      return await promiseSome(groups.map(async(group: Term): Promise<boolean> =>
        this.isMemberOfGroup(webId, group)));
    }
    return false;
  }

  /**
   * Checks if the given agent is member of a given vCard group.
   * @param webId - WebID of the agent that needs access.
   * @param group - URL of the vCard group that needs to be checked.
   *
   * @returns If the agent is member of the given vCard group.
   */
  private async isMemberOfGroup(webId: string, group: Term): Promise<boolean> {
    const groupDocument: ResourceIdentifier = { path: /^[^#]*/u.exec(group.value)![0] };

    // Fetch the required vCard group file
    const quads = await this.fetchQuads(groupDocument.path);
    return quads.countQuads(group, VCARD.terms.hasMember, webId, null) !== 0;
  }

  /**
   * Fetches quads from the given URL.
   */
  private async fetchQuads(url: string): Promise<Store> {
    const prom = (async(): Promise<Store> => {
      const representation = await fetchDataset(url);
      return readableToQuads(representation.data);
    })();
    return await prom;
  }
}
