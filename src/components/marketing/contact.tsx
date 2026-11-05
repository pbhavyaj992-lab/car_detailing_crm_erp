import { Phone, Mail, MessageCircle } from "lucide-react";
import { Reveal } from "./reveal";

const PHONE_DISPLAY = "+91 95864 61871";
const PHONE_TEL = "tel:+919586461871";
const EMAIL = "pbhavya0826@gmail.com";
const WHATSAPP = "https://wa.me/919586461871";

const cardBase =
  "group flex items-center gap-4 rounded-lg border px-5 py-4 transition-all duration-200 hover:-translate-y-[2px]";

export function ContactSection() {
  return (
    <section id="contact" className="container-page py-24 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
        <Reveal>
          <div className="eyebrow text-ink-faint">Talk to us</div>
          <h2 className="mt-5 max-w-[18ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
            Want to see it on your own workshop data?
          </h2>
          <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">
            Call or message us and we will walk you through the platform, set up your services and
            get your team signed in.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="grid gap-2.5">
            <a
              href={PHONE_TEL}
              className={`${cardBase} border-ink bg-ink text-canvas hover:shadow-lift`}
            >
              <Phone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">Call us</span>
                <span className="block truncate text-[13px] text-canvas/60">{PHONE_DISPLAY}</span>
              </span>
            </a>

            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer noopener"
              className={`${cardBase} border-hairline bg-surface text-ink hover:border-hairline-strong hover:shadow-soft`}
            >
              <MessageCircle
                className="h-[18px] w-[18px] shrink-0 text-ink-faint transition-colors duration-200 group-hover:text-copper"
                strokeWidth={1.75}
              />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">WhatsApp</span>
                <span className="block truncate text-[13px] text-ink-soft">{PHONE_DISPLAY}</span>
              </span>
            </a>

            <a
              href={`mailto:${EMAIL}`}
              className={`${cardBase} border-hairline bg-surface text-ink hover:border-hairline-strong hover:shadow-soft`}
            >
              <Mail
                className="h-[18px] w-[18px] shrink-0 text-ink-faint transition-colors duration-200 group-hover:text-copper"
                strokeWidth={1.75}
              />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">Email us</span>
                <span className="block truncate text-[13px] text-ink-soft">{EMAIL}</span>
              </span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
