interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Outlook Contacts (Microsoft 365) MCP Pack
 *
 * Requires OAuth connection — gateway injects credentials via _context.microsoft.
 * Read-only access to Outlook / Microsoft 365 contacts and people via Microsoft Graph v1.0.
 * Tools: list contacts, get contact, search people, get profile.
 */


interface OutlookContactsContext {
  microsoft?: { accessToken: string };
}

const API = 'https://graph.microsoft.com/v1.0';

/**
 * Fetch helper for Microsoft Graph.
 * - Returns { error: 'connection_required' } when no OAuth token is present.
 * - Returns { error: <status>, message: <body text> } on non-2xx responses.
 * - Otherwise returns the parsed JSON body.
 */
async function gFetch(
  ctx: OutlookContactsContext,
  url: string,
  options: RequestInit = {},
): Promise<unknown> {
  if (!ctx.microsoft) {
    return {
      error: 'connection_required',
      message: 'Connect your Microsoft 365 account at https://pipeworx.io/account',
    };
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ctx.microsoft.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { error: res.status, message: text };
  }
  return res.json();
}

const tools: McpToolExport['tools'] = [
  {
    name: 'outlook_list_contacts',
    description:
      'List contacts from an Outlook / Microsoft 365 address book. Returns compact contact records (name, email addresses, phone numbers, company, job title). Supports keyword search across the contact fields. Use to browse a user\'s saved Outlook / Microsoft 365 contacts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        top: {
          type: 'number',
          description: 'Maximum number of contacts to return (default 50, max 100).',
        },
        search: {
          type: 'string',
          description: 'Optional free-text keyword search across the contacts (name, email, company, etc.).',
        },
      },
      required: [],
    },
  },
  {
    name: 'outlook_get_contact',
    description:
      'Get the full details of a single Outlook / Microsoft 365 contact by its ID, including display name, all email addresses, business and mobile phone numbers, home address, company name, job title, and department. Use after outlook_list_contacts to read a contact from the address book in full.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The ID of the contact to retrieve (from outlook_list_contacts).',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'outlook_search_people',
    description:
      'Search the people most relevant to the signed-in Outlook / Microsoft 365 user — colleagues, frequent email contacts, and people in their organization — ranked by relevance. Returns matching people with name, email addresses, job title, and company. Use to find a coworker or frequent contact by name even if they are not in the saved address book.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Free-text query to match against relevant people (name, email, etc.).',
        },
        top: {
          type: 'number',
          description: 'Maximum number of people to return (default 25).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'outlook_get_profile',
    description:
      'Get the signed-in user\'s Microsoft 365 / Outlook profile: display name, email address, and user principal name. Use to identify whose contacts and address book are connected.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

interface GraphEmailAddress {
  name?: string;
  address?: string;
}

interface GraphScoredEmailAddress {
  address?: string;
  relevanceScore?: number;
}

interface GraphContact {
  id?: string;
  displayName?: string;
  emailAddresses?: GraphEmailAddress[];
  businessPhones?: string[];
  mobilePhone?: string;
  companyName?: string;
  jobTitle?: string;
}

interface GraphPerson {
  displayName?: string;
  scoredEmailAddresses?: GraphScoredEmailAddress[];
  jobTitle?: string;
  companyName?: string;
}

function compactContact(c: GraphContact): Record<string, unknown> {
  return {
    id: c.id,
    displayName: c.displayName,
    emails: c.emailAddresses?.map((e) => e.address),
    phones: [...(c.businessPhones ?? []), ...(c.mobilePhone ? [c.mobilePhone] : [])],
    companyName: c.companyName,
    jobTitle: c.jobTitle,
  };
}

function compactPerson(p: GraphPerson): Record<string, unknown> {
  return {
    displayName: p.displayName,
    emails: p.scoredEmailAddresses?.map((e) => e.address),
    jobTitle: p.jobTitle,
    companyName: p.companyName,
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const context = (args._context ?? {}) as OutlookContactsContext;
  delete args._context;

  switch (name) {
    case 'outlook_list_contacts': {
      const top = Math.min(100, Math.max(1, (args.top as number) ?? 50));
      const search = args.search as string | undefined;

      const params = new URLSearchParams({
        $top: String(top),
        $select: 'id,displayName,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle',
      });
      const headers: Record<string, string> = {};
      if (search) {
        params.set('$search', `"${search}"`);
        headers.ConsistencyLevel = 'eventual';
      }

      const result = await gFetch(context, `${API}/me/contacts?${params}`, { headers });
      const value = (result as { value?: GraphContact[] }).value;
      if (Array.isArray(value)) return value.map(compactContact);
      return result;
    }
    case 'outlook_get_contact': {
      const id = args.id as string;
      const params = new URLSearchParams({
        $select:
          'id,displayName,emailAddresses,businessPhones,mobilePhone,homeAddress,companyName,jobTitle,department',
      });
      const result = await gFetch(
        context,
        `${API}/me/contacts/${encodeURIComponent(id)}?${params}`,
      );
      const c = result as GraphContact & {
        homeAddress?: unknown;
        department?: string;
      };
      if (c && typeof c === 'object' && 'id' in c && !('error' in c)) {
        return {
          id: c.id,
          displayName: c.displayName,
          emailAddresses: c.emailAddresses,
          businessPhones: c.businessPhones,
          mobilePhone: c.mobilePhone,
          homeAddress: c.homeAddress,
          companyName: c.companyName,
          jobTitle: c.jobTitle,
          department: c.department,
        };
      }
      return result;
    }
    case 'outlook_search_people': {
      const query = args.query as string;
      const top = Math.min(100, Math.max(1, (args.top as number) ?? 25));
      const params = new URLSearchParams({
        $search: `"${query}"`,
        $top: String(top),
        $select: 'displayName,scoredEmailAddresses,jobTitle,companyName',
      });
      const result = await gFetch(context, `${API}/me/people?${params}`, {
        headers: { ConsistencyLevel: 'eventual' },
      });
      const value = (result as { value?: GraphPerson[] }).value;
      if (Array.isArray(value)) return value.map(compactPerson);
      return result;
    }
    case 'outlook_get_profile': {
      const params = new URLSearchParams({
        $select: 'displayName,mail,userPrincipalName',
      });
      return gFetch(context, `${API}/me?${params}`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 }, provider: 'microsoft' } satisfies McpToolExport;
