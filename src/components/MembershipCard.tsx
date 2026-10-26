import { User } from "lucide-react";
import { code128B } from "@/src/lib/code128";
import { cn } from "./ui";

/**
 * The Hiltonia Club membership card, drawn to match the printed cards
 * (resources/Membership card samples.jpg): portrait CR80 card, navy face,
 * logo and club name on top, photo, name, plan and expiry, then a barcode
 * strip and a coloured band with the card number. Band colour = category.
 *
 * It scales to whatever width its parent gives it (all sizes are in container
 * units), so the same card works on a phone, in the staff portal and for printing.
 *
 * With no card number yet (GymQ has not issued one) it shows as TEMPORARY and
 * the barcode carries the application reference instead.
 */

export type CardDuration = "m1" | "m3" | "m6" | "annual";

export type MembershipCardData = {
  fullName: string;
  category: string;
  duration: CardDuration;
  /** Membership number typed in from GymQ. Empty means the card is temporary. */
  cardNumber?: string | null;
  applicationRef?: string;
  /** ISO date, e.g. 2027-01-01. */
  expiresOn?: string | null;
  /** Passport photo URL (storage URL, or an object URL while previewing an upload). */
  photoUrl?: string | null;
};

/** Band colours taken from the printed cards. Corporate has no sample yet. */
const bandColour: Record<string, string> = {
  Individual: "#4a8b34",
  Couple: "#d8312a",
  Family: "#a3877f",
  "Extra child": "#a3877f",
  Corporate: "#5b6472", // guess: no printed sample seen yet
};

const categoryShort: Record<string, string> = {
  Individual: "IND",
  Couple: "COUPLE",
  Family: "FAMILY",
  "Extra child": "CHILD",
  Corporate: "CORPORATE",
};

const durationText: Record<CardDuration, string> = {
  m1: "1 MONTH",
  m3: "3 MONTHS",
  m6: "6 MONTHS",
  annual: "12 MONTHS",
};

/** "2027-01-01" -> "01/01/2027", as printed on the cards. */
function cardDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function MembershipCard({ data, className }: { data: MembershipCardData; className?: string }) {
  const temporary = !data.cardNumber;
  const barcodeText = data.cardNumber || data.applicationRef || "";
  const band = bandColour[data.category] ?? bandColour.Corporate;
  const plan = `${categoryShort[data.category] ?? data.category.toUpperCase()} - ${durationText[data.duration]}`;

  return (
    <div className={cn("@container w-full max-w-[340px]", className)}>
      <div
        role="img"
        aria-label={`${temporary ? "Temporary " : ""}Hiltonia Club membership card for ${data.fullName}, ${plan}${data.cardNumber ? `, number ${data.cardNumber}` : ""}`}
        className="relative aspect-[54/85.6] w-full overflow-hidden rounded-[4.5cqw] bg-[#2a2c63] font-[Arial,Helvetica,sans-serif] text-white shadow-[0_10px_30px_rgba(20,22,60,0.35)]"
      >
        {/* Face panels and the white rules seen on the printed card */}
        <div aria-hidden="true" className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[34%] bg-[#30336f]" />
          <div className="absolute left-[22%] top-0 h-[34%] w-[1.2cqw] bg-white/90" />
          <div className="absolute inset-x-0 top-[34%] h-[1.2cqw] bg-white/90" />
          <div className="absolute inset-x-0 top-[77.5%] h-[1.2cqw] bg-white/90" />
        </div>

        {/* Header: logo and club name */}
        <div className="absolute inset-x-[4%] top-[3%] flex items-center gap-[5cqw]">
          <ClubLogo className="w-[16%] shrink-0" />
          <div className="min-w-0 whitespace-nowrap">
            <div className="text-[7.4cqw] font-black leading-none tracking-[-0.15cqw] text-[#ff3b30]">HILTONIA CLUB</div>
            <div className="mt-[1.4cqw] text-[4.6cqw] font-bold leading-none">Transcorp Hilton Abuja</div>
          </div>
        </div>

        {/* Photo */}
        <div className="absolute left-1/2 top-[16.5%] aspect-[4/5] w-[42%] -translate-x-1/2 overflow-hidden bg-white">
          {data.photoUrl ? (
            // Plain img: the photo can be an upload preview (blob URL) that next/image cannot load.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-end justify-center bg-[#eef0f4] text-[#b5bccb]">
              <User strokeWidth={1.25} className="size-[85%]" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Name, plan, expiry */}
        <div className="absolute inset-x-[5%] top-[55.5%] text-center">
          <div className="line-clamp-2 text-[6.6cqw] uppercase leading-[1.1] tracking-[0.1cqw]">{data.fullName || "Member name"}</div>
          <div className="mt-[2cqw] text-[5cqw] font-bold leading-none">{plan}</div>
          <div className="mt-[1.6cqw] text-[4.6cqw] leading-none">
            {temporary ? (
              <i>Membership no. pending</i>
            ) : (
              <>
                <i>Expires on:</i> {data.expiresOn ? cardDate(data.expiresOn) : "-"}
              </>
            )}
          </div>
        </div>

        {/* Barcode strip */}
        <div className="absolute inset-x-0 top-[80%] flex h-[9.5%] items-center justify-center bg-white px-[10%]">
          {barcodeText && <Barcode value={barcodeText} />}
        </div>

        {/* Coloured band with the card number */}
        <div
          className="absolute inset-x-0 bottom-0 flex h-[10.5%] items-center justify-center"
          style={{ backgroundColor: band }}
        >
          <span className={cn("font-bold leading-none", temporary ? "text-[6cqw] tracking-[1cqw]" : "text-[10cqw] tracking-[0.6cqw]")}>
            {data.cardNumber || "TEMPORARY"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Barcode({ value }: { value: string }) {
  const widths = code128B(value);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${total} 40`} preserveAspectRatio="none" className="h-[78%] w-full" aria-hidden="true">
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={40} fill="#000" />
      ))}
    </svg>
  );
}

/** Round Hiltonia Fitness Club emblem: lettering around an orange disc with a star. */
function ClubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <path id="hiltonia-ring" d="M50 50 m-40 0 a40 40 0 1 1 80 0 a40 40 0 1 1 -80 0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="#1d1f4d" />
      <text fontSize="12.5" fontWeight="700" fontStyle="italic" letterSpacing="2.4" fill="#ff3b30">
        <textPath href="#hiltonia-ring" startOffset="2%">HILTONIA</textPath>
      </text>
      <text fontSize="10" fontWeight="700" letterSpacing="2.6" fill="#ffffff">
        <textPath href="#hiltonia-ring" startOffset="53%">FITNESS • CLUB</textPath>
      </text>
      <circle cx="50" cy="50" r="27" fill="#f26a21" />
      <path d="M50 30 L55.5 45 L71 45 L58.5 54.5 L63.5 70 L50 60.5 L36.5 70 L41.5 54.5 L29 45 L44.5 45 Z" fill="#3b2a72" />
    </svg>
  );
}
