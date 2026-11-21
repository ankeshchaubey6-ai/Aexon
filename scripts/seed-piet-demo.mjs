import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const USER_EMAIL = process.env.DEMO_TARGET_EMAIL;
const TARGET_SUBACCOUNT_ID = process.env.DEMO_TARGET_SUBACCOUNT_ID;
const SUBACCOUNT_NAME = "Piet Admission";

const ids = {
  lanes: [
    "c3c2c3c0-0000-4d00-9000-000000000001",
    "c3c2c3c0-0000-4d00-9000-000000000002",
    "c3c2c3c0-0000-4d00-9000-000000000003",
  ],
  contacts: Array.from({ length: 15 }, (_, i) =>
    `c3c2c3c0-1000-4d00-9000-${String(i + 1).padStart(12, "0")}`
  ),
  tickets: Array.from({ length: 9 }, (_, i) =>
    `c3c2c3c0-2000-4d00-9000-${String(i + 1).padStart(12, "0")}`
  ),
  funnels: [
    "c3c2c3c0-3000-4d00-9000-000000000001",
    "c3c2c3c0-3000-4d00-9000-000000000002",
  ],
};

const contacts = [
  ["Rahul Sharma", "demo.rahul.sharma@example.com"],
  ["Priya Verma", "demo.priya.verma@example.com"],
  ["Aman Gupta", "demo.aman.gupta@example.com"],
  ["Neha Singh", "demo.neha.singh@example.com"],
  ["Rohit Kumar", "demo.rohit.kumar@example.com"],
  ["Anjali Mishra", "demo.anjali.mishra@example.com"],
  ["Arjun Yadav", "demo.arjun.yadav@example.com"],
  ["Sneha Patel", "demo.sneha.patel@example.com"],
  ["Karan Malhotra", "demo.karan.malhotra@example.com"],
  ["Pooja Chauhan", "demo.pooja.chauhan@example.com"],
  ["Vikas Sharma", "demo.vikas.sharma@example.com"],
  ["Simran Kaur", "demo.simran.kaur@example.com"],
  ["Aditya Verma", "demo.aditya.verma@example.com"],
  ["Nisha Gupta", "demo.nisha.gupta@example.com"],
  ["Mohit Singh", "demo.mohit.singh@example.com"],
];

const tickets = [
  ["B.Tech CSE Admission", 120000, 0],
  ["B.Tech AI Admission", 135000, 0],
  ["BCA Admission", 75000, 0],
  ["MCA Admission", 90000, 1],
  ["MBA Admission", 150000, 1],
  ["Diploma Engineering Admission", 65000, 1],
  ["B.Tech CSE Counselling", 120000, 2],
  ["MBA Counselling", 150000, 2],
  ["BCA Application Support", 75000, 2],
];

const body = (sections) =>
  JSON.stringify([
    {
      id: "__body",
      name: "Body",
      type: "__body",
      styles: { backgroundColor: "#f8fafc", color: "#0f172a", padding: "0" },
      content: sections,
    },
  ]);

const textSection = (id, heading, copy, button) => ({
  id,
  name: heading,
  type: "section",
  styles: { padding: "64px 24px", backgroundColor: "#ffffff" },
  content: [
    {
      id: `${id}-container`,
      name: "Container",
      type: "container",
      styles: { width: "100%", maxWidth: "1100px", margin: "0 auto" },
      content: [
        {
          id: `${id}-heading`,
          name: "Text",
          type: "text",
          styles: { color: "#0f172a", fontSize: "36px", fontWeight: "700", marginBottom: "16px" },
          content: { innerText: heading },
        },
        {
          id: `${id}-copy`,
          name: "Text",
          type: "text",
          styles: { color: "#475569", fontSize: "18px", lineHeight: "1.6", marginBottom: "24px" },
          content: { innerText: copy },
        },
        ...(button
          ? [{
              id: `${id}-button`,
              name: "Link",
              type: "link",
              styles: { color: "#ffffff", backgroundColor: "#2563eb", padding: "12px 20px", borderRadius: "8px" },
              content: { innerText: button, href: "#enquiry" },
            }]
          : []),
      ],
    },
  ],
});

const formSection = (id) => ({
  id,
  name: "Enquiry Form",
  type: "section",
  styles: { padding: "64px 24px", backgroundColor: "#eff6ff" },
  content: [
    {
      id: `${id}-container`,
      name: "Container",
      type: "container",
      styles: { width: "100%", maxWidth: "700px", margin: "0 auto" },
      content: [{
        id: `${id}-form`,
        name: "Contact Form",
        type: "contactForm",
        styles: {},
        content: {
          formTitle: "Start your admission enquiry",
          formDescription: "This is a fictional demonstration form. Please do not submit private information.",
          formButton: "Send enquiry",
        },
      }],
    },
  ],
});

async function main() {
  if (!USER_EMAIL || !TARGET_SUBACCOUNT_ID) {
    throw new Error("Set DEMO_TARGET_EMAIL and DEMO_TARGET_SUBACCOUNT_ID in the local environment before seeding.");
  }

  const user = await db.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, agencyId: true },
  });
  if (!user?.agencyId) throw new Error("Target user or agency not found");

  const subAccount = await db.subAccount.findFirst({
    where: { id: TARGET_SUBACCOUNT_ID, agencyId: user.agencyId, name: { in: [SUBACCOUNT_NAME, "Piet admission"] } },
    select: { id: true, name: true, agencyId: true },
  });
  if (!subAccount) throw new Error("Verified Piet Admission target not found");

  const pipeline = await db.pipeline.findFirst({ where: { subAccountId: subAccount.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!pipeline) throw new Error("Target pipeline not found");

  await db.$transaction(async (tx) => {
    const laneNames = ["[DEMO] New Lead", "[DEMO] Contacted", "[DEMO] Converted"];
    for (let i = 0; i < laneNames.length; i++) {
      await tx.lane.upsert({
        where: { id: ids.lanes[i] },
        update: { name: laneNames[i], order: i, color: ["#3b82f6", "#f59e0b", "#10b981"][i], pipelineId: pipeline.id },
        create: { id: ids.lanes[i], name: laneNames[i], order: i, color: ["#3b82f6", "#f59e0b", "#10b981"][i], pipelineId: pipeline.id },
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      await tx.contact.upsert({ where: { id: ids.contacts[i] }, update: { name: `[DEMO] ${contacts[i][0]}`, email: contacts[i][1], subAccountId: subAccount.id }, create: { id: ids.contacts[i], name: `[DEMO] ${contacts[i][0]}`, email: contacts[i][1], subAccountId: subAccount.id } });
    }

    for (let i = 0; i < tickets.length; i++) {
      await tx.ticket.upsert({
        where: { id: ids.tickets[i] },
        update: { name: `[DEMO] ${tickets[i][0]}`, value: tickets[i][1], laneId: ids.lanes[tickets[i][2]], customerId: ids.contacts[i % contacts.length], description: "[DEMO] Fictional admission enquiry for supervisor presentation.", order: i },
        create: { id: ids.tickets[i], name: `[DEMO] ${tickets[i][0]}`, value: tickets[i][1], laneId: ids.lanes[tickets[i][2]], customerId: ids.contacts[i % contacts.length], description: "[DEMO] Fictional admission enquiry for supervisor presentation.", order: i },
      });
    }

    const funnels = [
      { id: ids.funnels[0], name: "[DEMO] B.Tech Admission Enquiry", subDomainName: "piet-admission-demo", description: "[DEMO] Capture enquiries for illustrative B.Tech programmes." },
      { id: ids.funnels[1], name: "[DEMO] Admission Counselling", subDomainName: "piet-counselling-demo", description: "[DEMO] Generate counselling and admission guidance enquiries." },
    ];
    for (const funnel of funnels) {
      await tx.funnel.upsert({ where: { id: funnel.id }, update: funnel, create: { ...funnel, subAccountId: subAccount.id, published: false } });
    }

    const pages = [
      [ids.funnels[0], "[DEMO] Home", "", body([textSection("home-hero", "Piet Admission — Your Pathway to a Better Future", "A fictional demonstration admission assistance service helping students explore courses, understand next steps and request guidance.", "Start an enquiry"), textSection("home-courses", "Explore your options", "B.Tech Computer Science, Artificial Intelligence, BCA, MCA, MBA and Diploma Engineering guidance — subject to official verification.", "View courses"), formSection("home-enquiry")])],
      [ids.funnels[0], "[DEMO] Courses", "courses", body([textSection("courses", "Courses and pathways", "Explore illustrative course options and speak with an admission counsellor. Eligibility and availability must be verified with the official institution.", "Ask about a course")])],
      [ids.funnels[0], "[DEMO] Enquiry", "enquiry", body([textSection("enquiry-intro", "Tell us what you are looking for", "Share a few details and our fictional counselling team can explain the next steps.", null), formSection("enquiry-form")])],
      [ids.funnels[0], "[DEMO] Thank You", "thank-you", body([textSection("thank-you", "Thank you for your enquiry", "Your demonstration enquiry has been received. A counsellor can follow up with course information and next steps.", "Return home")])],
      [ids.funnels[1], "[DEMO] Counselling Landing", "", body([textSection("counselling", "Admission counselling made clearer", "Get a simple, student-friendly walkthrough of course discovery, document preparation and enquiry follow-up.", "Request counselling"), formSection("counselling-form")])],
      [ids.funnels[1], "[DEMO] Counselling Information", "information", body([textSection("process", "How the guidance process works", "1. Share your interests. 2. Review illustrative options. 3. Discuss next steps. 4. Verify all official requirements before applying.", "Register for counselling")])],
      [ids.funnels[1], "[DEMO] Registration", "registration", body([textSection("registration", "Register for a counselling conversation", "This fictional form is for demonstrating lead capture inside Aexon.", null), formSection("registration-form")])],
      [ids.funnels[1], "[DEMO] Confirmation", "confirmation", body([textSection("confirmation", "Registration received", "Thanks. Your demonstration registration is now visible as a contact in the Piet Admission workspace.", "Back to counselling")])],
    ];
    for (let i = 0; i < pages.length; i++) {
      const [funnelId, name, pathName, content] = pages[i];
      await tx.funnelPage.upsert({ where: { id: `c3c2c3c0-4000-4d00-9000-${String(i + 1).padStart(12, "0")}` }, update: { name, pathName, order: i, content }, create: { id: `c3c2c3c0-4000-4d00-9000-${String(i + 1).padStart(12, "0")}`, funnelId, name, pathName, order: i, content } });
    }
  }, { timeout: 30000 });

  console.log(JSON.stringify({ seeded: true, subAccountId: subAccount.id, contacts: contacts.length, tickets: tickets.length, funnels: 2, pages: 8, mediaPreserved: true }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
