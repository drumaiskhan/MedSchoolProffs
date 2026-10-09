// v64 — Profile → About tab. This used to be the big "Connect With Us" footer that
// rendered under every profile tab; it now lives here on its own, with the social
// links as physical 3D keys. Presentational; styles live in connect3d.css.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Check, ChevronRight, Clock3, Mail, MapPin, MessageCircle, Stethoscope } from 'lucide-react';
import { siteContentApi } from '@/lib/api';
import { TiltDiv, vars } from '@/lib/tilt';

// Admin-entered URLs sometimes come without a scheme ("instagram.com/…").
const absolute = (url: string) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);

// SUPPORT_WHATSAPP can be a wa.me link or a bare number. A local "03xx…" number is
// turned into its +92 form (the app's students are in Pakistan) so wa.me can open it.
const whatsappHref = (value?: string) => {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  let digits = v.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `92${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
};

// Brand glyphs are drawn here rather than imported: lucide has deprecated its brand icons.
type GlyphProps = { className?: string };
const stroke = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const fillOnly = { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const;
const InstagramGlyph = ({ className }: GlyphProps) => <svg {...stroke} className={className}><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4.1" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>;
const YoutubeGlyph = ({ className }: GlyphProps) => <svg {...stroke} className={className}><rect x="2.5" y="5.5" width="19" height="13" rx="4.2" /><path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" /></svg>;
const FacebookGlyph = ({ className }: GlyphProps) => <svg {...fillOnly} className={className}><path d="M14.4 21v-8.1h2.7l.5-3.3h-3.2V7.5c0-.9.4-1.6 1.7-1.6h1.6V3.1c-.3 0-1.3-.2-2.4-.2-2.5 0-4.1 1.5-4.1 4.2v2.2H8.4v3.3h2.8V21z" /></svg>;
const LinkedinGlyph = ({ className }: GlyphProps) => <svg {...fillOnly} className={className}><rect x="3.4" y="9" width="3.7" height="11.6" rx=".7" /><circle cx="5.25" cy="5.3" r="2.05" /><path d="M10 9h3.5v1.6c.6-1.1 1.9-1.9 3.6-1.9 3 0 3.9 1.9 3.9 4.7v6.2h-3.7v-5.4c0-1.3-.3-2.2-1.6-2.2-1.4 0-2 1-2 2.3v5.3H10z" /></svg>;
const WhatsappGlyph = ({ className }: GlyphProps) => <MessageCircle className={className} aria-hidden="true" strokeWidth={2.2} />;

export function ProfileAbout() {
  const q = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get });
  const c = q.data;
  const year = new Date().getFullYear();
  const name = c?.PLATFORM_NAME || 'MedschoolProffs';

  if (q.isLoading) return <div className="mt-5 grid gap-5" aria-busy="true"><div className="skeleton h-40 rounded-2xl" /><div className="skeleton h-72 rounded-[1.75rem]" /></div>;

  const keys = [
    { id: 'instagram', label: 'Instagram', href: c?.SOCIAL_INSTAGRAM ? absolute(c.SOCIAL_INSTAGRAM) : '', Glyph: InstagramGlyph },
    { id: 'youtube', label: 'YouTube', href: c?.SOCIAL_YOUTUBE ? absolute(c.SOCIAL_YOUTUBE) : '', Glyph: YoutubeGlyph },
    { id: 'facebook', label: 'Facebook', href: c?.SOCIAL_FACEBOOK ? absolute(c.SOCIAL_FACEBOOK) : '', Glyph: FacebookGlyph },
    { id: 'linkedin', label: 'LinkedIn', href: c?.SOCIAL_LINKEDIN ? absolute(c.SOCIAL_LINKEDIN) : '', Glyph: LinkedinGlyph },
    { id: 'whatsapp', label: 'WhatsApp', href: whatsappHref(c?.SUPPORT_WHATSAPP), Glyph: WhatsappGlyph },
  ].filter((k) => k.href);

  const contact = [
    c?.CONTACT_EMAIL && { id: 'email', icon: Mail, label: 'Email', value: c.CONTACT_EMAIL, href: `mailto:${c.CONTACT_EMAIL}` },
    c?.CONTACT_LOCATION && { id: 'location', icon: MapPin, label: 'Based in', value: c.CONTACT_LOCATION, href: '' },
    c?.SUPPORT_HOURS && { id: 'hours', icon: Clock3, label: 'Support hours', value: c.SUPPORT_HOURS, href: '' },
  ].filter(Boolean) as Array<{ id: string; icon: typeof Mail; label: string; value: string; href: string }>;

  const features = c?.features ?? [];
  const quickLinks = c?.quickLinks ?? [];

  return <div className="mt-5 grid gap-5" data-testid="tab-panel-about">
    <section className="rounded-2xl border border-border bg-card p-6" data-testid="card-about-platform">
      <div className="flex items-center gap-3">
        <span className="ab-puck"><Stethoscope size={19} /></span>
        <div className="min-w-0"><h3 className="font-bold">{name}</h3>{c?.PLATFORM_TAGLINE && <p className="mt-0.5 text-xs text-muted-foreground">{c.PLATFORM_TAGLINE}</p>}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{c?.PLATFORM_DESCRIPTION || 'Empowering medical students with comprehensive study resources and innovative learning tools to ace their professional exams.'}</p>
      {features.length > 0 && <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">{features.map((f) => <li key={f} className="flex items-start gap-2 text-xs font-semibold"><span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check size={10} strokeWidth={3} /></span>{f}</li>)}</ul>}
    </section>

    <TiltDiv className="cn3d" testId="card-connect-with-us">
      <div className="cn3d__grid" aria-hidden="true" />
      <div className="cn3d__copy">
        <h3 className="cn3d__title">Connect with us</h3>
        <p className="cn3d__text">Follow along for new resources and updates, or reach out any time.</p>
      </div>
      <div className="cn3d__tray">
        {keys.length > 0
          ? <ul className="cn3d__keys">{keys.map((k, i) => <li key={k.id} style={vars({ '--i': i })}>
              <a href={k.href} target="_blank" rel="noopener noreferrer" className="cn3d__key" data-k={k.id} aria-label={`${k.label} (opens in a new tab)`} data-testid={`link-connect-${k.id}`}>
                <span className="cn3d__cap"><k.Glyph /></span>
                <span className="cn3d__label">{k.label}</span>
              </a>
            </li>)}</ul>
          : <p className="cn3d__empty">Social links haven't been added yet.{c?.CONTACT_EMAIL ? ' You can still reach us by email below.' : ''}</p>}
      </div>
    </TiltDiv>

    {contact.length > 0 && <section>
      <h3 className="mb-3 text-sm font-extrabold">Contact</h3>
      <div className="grid gap-3 sm:grid-cols-2">{contact.map((item) => {
        const body = <><span className="ab-puck"><item.icon size={18} /></span><span className="min-w-0"><span className="ab-plate__label block">{item.label}</span><span className="ab-plate__value block">{item.value}</span></span></>;
        return item.href
          ? <a key={item.id} href={item.href} className="ab-plate" data-testid={`link-contact-${item.id}`}>{body}</a>
          : <div key={item.id} className="ab-plate" data-testid={`text-contact-${item.id}`}>{body}</div>;
      })}</div>
    </section>}

    {quickLinks.length > 0 && <section>
      <h3 className="mb-3 text-sm font-extrabold">Quick links</h3>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{quickLinks.map((l, i) => {
        const cls = `flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/60 ${i > 0 ? 'border-t border-border' : ''}`;
        const inner = <>{l.label}<ChevronRight size={15} className="shrink-0 text-muted-foreground" /></>;
        return /^https?:\/\//i.test(l.url)
          ? <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
          : <Link key={l.label} href={l.url} className={cls}>{inner}</Link>;
      })}</div>
    </section>}

    <p className="pb-2 text-center font-mono-app text-[10px] text-muted-foreground">© {year} {name}. {c?.COPYRIGHT_NOTICE || 'All rights reserved.'}</p>
  </div>;
}
