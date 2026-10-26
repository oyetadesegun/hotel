/**
 * The online membership application (AGENTS-Form.md), as stored in memberships.profile.
 * Used to read the submitted form and to show it to staff, so both stay in step.
 */

export type MembershipProfile = {
  officeAddress: string;
  usesHotel: "yes" | "no";
  hotelFacilities: string[];
  hotelFacilitiesOther: string;
  lastExamDate: string;
  lastExamPlace: string;
  operations: string;
  limitations: string[];
  limitationsOther: string;
  medications: string;
  allergies: string;
  smokes: "yes" | "no";
  smokesPerDay: string;
  alcohol: string;
  activities: string;
  physicianPhone: string;
  physicianAddress: string;
  emergency: { name: string; relationship: string; phone: string; address: string };
  referee: { name: string; address: string; phone: string; email: string };
  declarationsAccepted: string[];
  signature: string;
  signedAt: string;
};

export const declarations = [
  "I am over 18 years old and of sound mind.",
  "I have completed the health history in this application truthfully, and I am physically fit to use the club's facilities.",
  "I agree to follow the club rules, and I accept that management can revoke my membership if I do not.",
  "I give up any right to claim against the Hotel or the club for damage, injury or death while I am a member.",
];

const text = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const list = (fd: FormData, k: string) => fd.getAll(k).map((v) => String(v).slice(0, 100));

/** Reads the profile form. Returns the profile, or the first problem found. */
export function readProfile(fd: FormData): { profile: MembershipProfile } | { error: string } {
  const p: MembershipProfile = {
    officeAddress: text(fd, "officeAddress"),
    usesHotel: text(fd, "usesHotel") === "yes" ? "yes" : "no",
    hotelFacilities: list(fd, "hotelFacilities"),
    hotelFacilitiesOther: text(fd, "hotelFacilitiesOther", 200),
    lastExamDate: text(fd, "lastExamDate", 10),
    lastExamPlace: text(fd, "lastExamPlace", 200),
    operations: text(fd, "operations"),
    limitations: list(fd, "limitations"),
    limitationsOther: text(fd, "limitationsOther", 200),
    medications: text(fd, "medications"),
    allergies: text(fd, "allergies"),
    smokes: text(fd, "smokes") === "yes" ? "yes" : "no",
    smokesPerDay: text(fd, "smokesPerDay", 20),
    alcohol: text(fd, "alcohol", 200),
    activities: text(fd, "activities"),
    physicianPhone: text(fd, "physicianPhone", 40),
    physicianAddress: text(fd, "physicianAddress"),
    emergency: {
      name: text(fd, "emergencyName", 120),
      relationship: text(fd, "emergencyRelationship", 60),
      phone: text(fd, "emergencyPhone", 40),
      address: text(fd, "emergencyAddress"),
    },
    referee: {
      name: text(fd, "refereeName", 120),
      address: text(fd, "refereeAddress"),
      phone: text(fd, "refereePhone", 40),
      email: text(fd, "refereeEmail", 200),
    },
    declarationsAccepted: declarations.filter((_, i) => fd.get(`declaration${i + 1}`) === "on"),
    signature: text(fd, "signature", 120),
    signedAt: new Date().toISOString(),
  };

  const required: [string, string][] = [
    [p.officeAddress, "office address"],
    [p.operations, "past operations or hospital stays"],
    [p.medications, "medicines"],
    [p.allergies, "allergies"],
    [p.alcohol, "alcohol"],
    [p.emergency.name, "emergency contact name"],
    [p.emergency.relationship, "emergency contact relationship"],
    [p.emergency.phone, "emergency contact phone"],
    [p.referee.name, "referee name"],
    [p.referee.address, "referee address"],
    [p.referee.phone, "referee phone"],
    [p.signature, "signature"],
  ];
  const missing = required.find(([v]) => !v);
  if (missing) return { error: `Please fill in the ${missing[1]}.` };
  if (p.declarationsAccepted.length !== declarations.length) return { error: "Please tick every statement in the declaration." };
  return { profile: p };
}

/** Sections for showing a submitted profile to staff. */
export function profileSections(p: MembershipProfile): { title: string; rows: [string, string][] }[] {
  const none = (v: string) => v || "Not given";
  const joinOther = (items: string[], other: string) =>
    items.filter((i) => i !== "Other").concat(other ? [`Other: ${other}`] : []).join(", ") || "None";
  return [
    { title: "Details", rows: [["Office address", p.officeAddress]] },
    {
      title: "Hotel facilities",
      rows: [
        ["Uses other hotel facilities", p.usesHotel === "yes" ? "Yes" : "No"],
        ...(p.usesHotel === "yes" ? [["Which", joinOther(p.hotelFacilities, p.hotelFacilitiesOther)] as [string, string]] : []),
      ],
    },
    {
      title: "Health history",
      rows: [
        ["Last medical check-up", [p.lastExamDate, p.lastExamPlace].filter(Boolean).join(", ") || "Not given"],
        ["Operations or hospital stays", p.operations],
        ["Limits", joinOther(p.limitations, p.limitationsOther)],
        ["Medicines", p.medications],
        ["Allergies", p.allergies],
        ["Smokes", p.smokes === "yes" ? `Yes, ${p.smokesPerDay || "?"} a day` : "No"],
        ["Alcohol", p.alcohol],
        ["Regular exercise", none(p.activities)],
        ["Doctor", [p.physicianPhone, p.physicianAddress].filter(Boolean).join(", ") || "Not given"],
      ],
    },
    {
      title: "Emergency contact",
      rows: [
        ["Name", `${p.emergency.name} (${p.emergency.relationship})`],
        ["Phone", p.emergency.phone],
        ["Address", none(p.emergency.address)],
      ],
    },
    {
      title: "Referee",
      rows: [
        ["Name", p.referee.name],
        ["Office address", p.referee.address],
        ["Phone", p.referee.phone],
        ["Email", none(p.referee.email)],
      ],
    },
    {
      title: "Declaration",
      rows: [
        ["All statements accepted", p.declarationsAccepted.length === declarations.length ? "Yes" : "No"],
        ["Signed as", p.signature],
        ["Signed on", new Date(p.signedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })],
      ],
    },
  ];
}
