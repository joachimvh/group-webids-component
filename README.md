# Group WebIDs component

Adds support for Group WebIDs to a 
[Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) instance.

Run `npm start` to have a CSS instance that combines `@css:config/file.json` with the new components here.

## What are Group WebIDs?

The idea behind these, is that sometimes you might want to use Solid authentication
to identify as being part of group without having to tell a server explicitly who you are.

## What does a Group WebID look like?

Similarly to a Solid WebID, a `solid:oidcIssuer` triple
is [expected](https://solidproject.org/TR/oidc#oidc-issuer-discovery) in the Group WebID,
indicating that this server is authorized to be an issuer.

Besides that, `vcard:hasMember` triples are expected,
with the objects being the WebIDs that are part of this group,
similarly to how groups are
[defined in the WAC specification](https://solidproject.org/TR/2022/wac-20220705#acl-agentgroup).
Accounts that are linked to at least one of the WebIDs here can identify as the corresponding group WebID.

For example, below is a Group WebID that has 1 member:
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.

<http://localhost:3000/groups/group> 
   solid:oidcIssuer <http://localhost:3000/>;
   vcard:hasMember <http://localhost:3000/test/profile/card#me>.
```
Any account that has the WebID `http://localhost:3000/test/profile/card#me` linked
can then also authenticate as `http://localhost:3000/groups/group`.

## How does it work?

The files in this repository and how they support Group WebIDs.

### src/GroupWebIdStore

This class replaces the `BaseWebIdStore` by changing how the `isLinked` check works.
When using this new class, any time the server needs to check if a WebID is linked to an account,
it first performs the standard check to see if that link is stored on the server.
But if it is not, it performs a GET request on the WebID to identify if it might be a Group WebID
that uses the server as issuers, and contains a WebID linked to the account.

### src/GroupWebIdAccessChecker

This class replaces the `AgentGroupAccessChecker`,
which is responsible for handling the `acl:agentGroup` predicates in an ACL resource when using WAC.
The new version of this class makes it so that when you are authenticating with a Group WebID,
`acl:agentGroup` triples that have the Group WebID as subject are validated immediately
instead of checking the contents.

This is one is not really necessary but extends the functionality.

### templates/consent-group.html.ejs

Replaces the original consent template.
When choosing a WebID, this new template adds a text box for choosing a Group WebID instead of a standard linked WebID.

### config/group-webids.json

A Components.js configuration that overrides the necessary classes.
Can be combined with any of the default CSS configurations.

## Potential future enhancements

This component was mostly made with the idea of showing how it works and is still rough around the edges.
Below are some potential improvements.

### Register Group WebIDs

If a user is able to register which Group WebIDs they can use,
this would improve several things.
First of all, the UI could be upgraded from a text box to a list of Group WebIDs to choose from,
similarly to standard WebIDs currently.
Secondly, the server would have to perform less GET requests
to get all the necessary information about the Group WebIDs all the time.
Although some would still be necessary to make sure the contents haven't changed.

### Improve fetch requests

Caching could perhaps be used to reduce the number of GET requests when authenticating.
If the server notices the WebID is stored on the server itself
it could also check the contents without having to do a GET request.

### Nested groups

Perhaps there could be groups that contain other groups, 
to prevent having to write down all the WebIDs every time if there is overlap.
These are not yet supported.
