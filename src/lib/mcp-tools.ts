import clubContext from '../data/club-context.json' with { type: 'json' };
import eboard from '../data/eboard.json' with { type: 'json' };

export interface MCPTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const DEFAULT_MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_club_info',
    description: 'Read maintained, member-facing CBC @ NJIT facts: membership, mission, current e-board, existing club channels, or learning activities. This is curated data, not a live search.',
    input_schema: {
      type: 'object',
      properties: { info_type: { type: 'string', enum: ['about', 'membership', 'mission', 'eboard', 'contact', 'activities'] } },
      required: ['info_type'],
    },
  },
  {
    name: 'get_hackathon_info',
    description: 'Read the planned Spring 2027 NJIT hackathon status. Only the season and year are confirmed; do not infer dates, prizes, registration, rules, or a venue.',
    input_schema: {
      type: 'object',
      properties: { info_type: { type: 'string', enum: ['overview', 'schedule', 'tracks', 'location', 'prizes', 'eligibility', 'registration'] } },
      required: ['info_type'],
    },
  },
  {
    name: 'get_member_benefits',
    description: 'Read member-facing benefit guidance. The eligibility, organization_id, and request_process topics cover API credits; claude_pro covers the separate Claude Pro benefit from meeting attendance and check-in, including what is not confirmed. Cannot submit requests, access private forms, or inspect accounts.',
    input_schema: {
      type: 'object',
      properties: { topic: { type: 'string', enum: ['overview', 'eligibility', 'organization_id', 'request_process', 'claude_pro'] } },
      required: ['topic'],
    },
  },
  {
    name: 'search_workshops',
    description: 'Check the maintained workshop and meeting list. No specific meetings or workshops are currently confirmed in this data. This tool cannot browse announcements or a live calendar.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, filter: { type: 'string', enum: ['upcoming', 'past', 'all'] } },
      required: ['query'],
    },
  },
];

export async function getAllTools(): Promise<MCPTool[]> {
  return DEFAULT_MCP_TOOLS;
}

export async function executeMCPTool(toolName: string, toolInput: Record<string, unknown>): Promise<unknown> {
  const metadata = { reviewedOn: clubContext.reviewedOn, source: 'Maintained member-facing club information' };
  const unconfirmed = (message: string) => ({ ...metadata, status: 'not_confirmed', message, announcements: clubContext.contacts.discord });
  switch (toolName) {
    case 'get_club_info': {
      const sections: Record<string, unknown> = {
        about: clubContext.club,
        membership: clubContext.club.membership,
        mission: clubContext.club.mission,
        eboard,
        contact: clubContext.contacts,
        activities: clubContext.club.activities,
      };
      const key = String(toolInput.info_type);
      const data = Object.hasOwn(sections, key) ? sections[key] : undefined;
      return data === undefined ? unconfirmed('This club detail is not available.') : { ...metadata, data };
    }
    case 'get_hackathon_info':
      return { ...metadata, event: clubContext.events.hackathon, message: 'Only a Spring 2027 hackathon is planned. Date, location, registration, rules, prizes, and schedule are not confirmed.' };
    case 'get_member_benefits': {
      const credits = clubContext.memberBenefits.apiCredits;
      const sections: Record<string, unknown> = {
        overview: clubContext.memberBenefits,
        eligibility: { eligibility: credits.eligibility, availability: credits.availability },
        organization_id: credits.organizationId,
        request_process: { instructions: credits.requestProcess, availability: credits.availability, contact: clubContext.contacts.discord },
        claude_pro: clubContext.memberBenefits.claudePro,
      };
      const key = String(toolInput.topic);
      const data = Object.hasOwn(sections, key) ? sections[key] : undefined;
      return data === undefined ? unconfirmed('This member benefit is not confirmed.') : { ...metadata, data };
    }
    case 'search_workshops':
      return { ...metadata, status: 'no_confirmed_events', meetings: [], workshops: [], plannedHackathon: clubContext.events.hackathon, announcements: clubContext.contacts.discord, message: 'No specific meeting or workshop is confirmed in this maintained data. This is not a live calendar search.' };
    default:
      return { status: 'unknown_tool', message: 'That information tool is not available.' };
  }
}
