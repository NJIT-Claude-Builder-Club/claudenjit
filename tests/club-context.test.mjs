import { test } from 'node:test';
import assert from 'node:assert/strict';
import club from '../src/data/club-context.json' with { type: 'json' };
import board from '../src/data/eboard.json' with { type: 'json' };
import { getSystemMessage } from '../src/lib/chat-policy.ts';
import { DEFAULT_MCP_TOOLS, executeMCPTool } from '../src/lib/mcp-tools.ts';

test('club tools and system context use the same three confirmed officers', async () => {
  assert.deepEqual(board, [
    {name:'Donovan McHenry',role:'President'},
    {name:'Walter Zhong',role:'Vice President'},
    {name:'Dhruva Lepakshi',role:'Marketing Manager'},
  ]);
  assert.deepEqual((await executeMCPTool('get_club_info', {info_type:'eboard'})).data, board);
  const system = getSystemMessage(new Date('2026-10-14T14:00:00Z'));
  board.forEach(({name,role}) => {assert(system.includes(name));assert(system.includes(role));});
  assert.doesNotMatch(system, /Tai Vu|Ahmed Asad|80\+ members/);
});

test('only a planned Spring 2027 hackathon is exposed, with no invented details', async () => {
  const result = await executeMCPTool('get_hackathon_info', {info_type:'prizes'});
  assert.equal(result.event.status,'planned');
  assert.equal(result.event.year,2027);
  for(const field of ['date','location','registrationUrl','prizes','rules','schedule']) assert.equal(result.event[field],null);
  assert.equal((await executeMCPTool('search_workshops',{query:'next meeting'})).status,'no_confirmed_events');
  assert.doesNotMatch(JSON.stringify({club,tools:DEFAULT_MCP_TOOLS}), /happening today|April 26|Kupfrian|9:00 AM/);
});

test('member benefit guidance separates API credits from subscriptions and includes conditions', async () => {
  const result = await executeMCPTool('get_member_benefits',{topic:'overview'});
  assert.equal(result.data.apiCredits.amountUSD,25);
  assert.match(result.data.apiCredits.organizationId,/platform\.claude\.com/);
  assert.match(result.data.apiCredits.eligibility,/school email/);
  assert.match(result.data.apiCredits.availability,/not immediately or automatically/);
});

test('Claude Pro comes from meeting attendance and check-in, separate from API credits, with no invented details', async () => {
  const {data} = await executeMCPTool('get_member_benefits',{topic:'claude_pro'});
  assert.match(data.description,/attending meetings/);
  assert.match(data.description,/check-in form/);
  assert.match(data.eligibility,/Joining the club does not by itself grant Claude Pro/);
  assert.match(data.separateFromApiCredits,/separate/);
  assert.match(data.separateFromApiCredits,/do not activate/);
  for(const detail of [/how long/i,/how many meetings|how often/i,/activated/i,/renewal/i]) assert.match(data.unconfirmed,detail);
  assert.match(data.requestProcess,/cannot check eligibility or Pro status/);
  assert.equal(data.confirmedOn,'2026-10-29');
  assert.equal(club.reviewedOn,'2026-10-14');
  assert.doesNotMatch(JSON.stringify(data),/\b\d+\s*(?:months?|weeks?|days?|meetings?)\b|forms\.gle|https?:/i);
  assert.deepEqual((await executeMCPTool('get_member_benefits',{topic:'overview'})).data, club.memberBenefits);
  const system=getSystemMessage(new Date('2026-10-29T14:00:00Z'));
  assert(system.includes(club.memberBenefits.claudePro.description));
  assert.doesNotMatch(system,/isn't a confirmed member benefit|No Claude Pro subscription benefit is confirmed/);
});

test('published data contains no internal operational fields or private form links', () => {
  const serialized = JSON.stringify({club,board});
  assert.doesNotMatch(serialized, /stipend|payroll|reimbursement|staff.only|ambassador.hub|manager.email|forms\.gle|docs\.google\.com\/forms/i);
});

test('policy uses New Jersey dates and labels stale context as last confirmed', () => {
  const system=getSystemMessage(new Date('2026-10-15T02:00:00Z'));
  assert.match(system,/Wednesday, October 14, 2026/);
  assert.match(system,/Do not use emojis, em dashes/);
  assert.match(system,/no live web search/i);
  const stale=getSystemMessage(new Date('2027-02-01T15:00:00Z'));
  assert.match(stale,/more than 90 days old/);
  assert.match(stale,/not as verified current information/);
});

test('unknown sections cannot access inherited object properties', async () => {
  assert.equal((await executeMCPTool('get_club_info',{info_type:'__proto__'})).status,'not_confirmed');
  assert.equal((await executeMCPTool('get_member_benefits',{topic:'constructor'})).status,'not_confirmed');
});
