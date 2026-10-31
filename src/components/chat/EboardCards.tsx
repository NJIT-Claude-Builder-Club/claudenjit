import Image from 'next/image';
import { Linkedin } from 'lucide-react';
import { getInitials, type EboardCard } from '@/lib/chat-presentation';

export function EboardCards({ members }: { members: EboardCard[] }) {
  if (members.length === 0) return null;
  // A single officer has room for a larger photo; several stay compact chips.
  const single = members.length === 1;
  return (
    <ul className={`eboard-list${single ? ' eboard-single' : ''}`} aria-label="E-board">
      {members.map((member) => {
        const content = (
          <>
            <span className="eboard-avatar">
              {member.photo
                ? <Image src={member.photo} alt="" fill sizes={single ? '192px' : '72px'} />
                : <span aria-hidden="true">{getInitials(member.name)}</span>}
            </span>
            <span className="eboard-text">
              <span className="eboard-name">{member.name}</span>
              <span className="eboard-role">{member.role}</span>
            </span>
          </>
        );
        return (
          <li key={member.name}>
            {member.linkedin ? (
              <a className="eboard-member eboard-link" href={member.linkedin} target="_blank" rel="noopener noreferrer" title={`${member.name} on LinkedIn`}>
                {content}
                <Linkedin className="eboard-linkedin" size={single ? 18 : 15} strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
              </a>
            ) : (
              <div className="eboard-member">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
