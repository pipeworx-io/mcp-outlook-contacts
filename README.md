# mcp-outlook-contacts

Outlook Contacts (Microsoft 365) MCP Pack

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1856+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

| Tool | Description |
|------|-------------|
| `outlook_list_contacts` | List contacts from an Outlook / Microsoft 365 address book. Returns compact contact records (name, email addresses, phone numbers, company, job title). Supports keyword search across the contact fields. Use to browse a user's saved Outlook / Microsoft 365 contacts. |
| `outlook_get_contact` | Get the full details of a single Outlook / Microsoft 365 contact by its ID, including display name, all email addresses, business and mobile phone numbers, home address, company name, job title, and department. Use after outlook_list_contacts to read a contact from the address book in full. |
| `outlook_search_people` | Search the people most relevant to the signed-in Outlook / Microsoft 365 user — colleagues, frequent email contacts, and people in their organization — ranked by relevance. Returns matching people with name, email addresses, job title, and company. Use to find a coworker or frequent contact by name even if they are not in the saved address book. |
| `outlook_get_profile` | Get the signed-in user's Microsoft 365 / Outlook profile: display name, email address, and user principal name. Use to identify whose contacts and address book are connected. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "outlook-contacts": {
      "url": "https://gateway.pipeworx.io/outlook-contacts/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/outlook-contacts/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1856+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

This pack runs against a connected microsoft account, so it needs a Pipeworx key: sign in at https://pipeworx.io/account, connect microsoft, then call `POST https://gateway.pipeworx.io/v1/tools/outlook_list_contacts` with `Authorization: Bearer <your Pipeworx key>`. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/outlook_list_contacts`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "outlook-contacts": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-outlook-contacts"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-outlook-contacts
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Outlook Contacts data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
