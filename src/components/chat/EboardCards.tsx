import Image from 'next/image';
import { getInitials, type EboardCard } from '@/lib/chat-presentation';

export function EboardCards({ members }: { members: EboardCard[] }) {
  if (members.length === 0) return null;
  // A single officer has room for a larger photo; several stay compact chips.
  const single = members.length === 1;
  return (
    <ul className={`eboard-list${single ? ' eboard-single' : ''}`} aria-label="E-board">
      {members.map((member) => (
        <li key={member.name} className="eboard-member">
          <span className="eboard-avatar">
            {member.photo
              ? <Image src={member.photo} alt="" fill sizes={single ? '192px' : '72px'} />
              : <span aria-hidden="true">{getInitials(member.name)}</span>}
          </span>
          <span className="eboard-text">
            <span className="eboard-name">{member.name}</span>
            <span className="eboard-role">{member.role}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
