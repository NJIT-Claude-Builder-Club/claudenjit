import { Github, GraduationCap, Instagram, Link, Mail, MessagesSquare, type LucideIcon } from 'lucide-react';
import type { ClubLink } from '@/lib/chat-presentation';

const ICONS: Record<string, LucideIcon> = {
  discord: MessagesSquare,
  instagram: Instagram,
  highlander_hub: GraduationCap,
  email: Mail,
  github: Github,
};

export function ClubLinkCards({ links }: { links: ClubLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="club-links" aria-label="Club links">
      {links.map((link) => {
        const Icon = ICONS[link.channel] ?? Link;
        const external = link.url.startsWith('https://');
        return (
          <li key={link.channel}>
            <a className="club-link" href={link.url} title={link.description} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="club-link-label">{link.label}</span>
              {external && <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
