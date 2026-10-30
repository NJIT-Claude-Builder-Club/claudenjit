import Image from 'next/image';
import { getInitials, type EboardCard } from '@/lib/chat-presentation';

export function EboardCards({ members }: { members: EboardCard[] }) {
  if (members.length === 0) return null;
  return (
    <ul className="eboard-cards" aria-label="E-board">
      {members.map((member) => (
        <li key={member.name} className="eboard-card">
          <div className="eboard-photo">
            {member.photo
              ? <Image src={member.photo} alt={`Photo of ${member.name}`} fill sizes="(max-width: 540px) 45vw, 240px" />
              : <span className="eboard-initials" aria-hidden="true">{getInitials(member.name)}</span>}
          </div>
          <div className="eboard-name">{member.name}</div>
          <div className="eboard-role">{member.role}</div>
        </li>
      ))}
    </ul>
  );
}
