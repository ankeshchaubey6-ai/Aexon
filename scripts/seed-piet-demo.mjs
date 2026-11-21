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
  media: Array.from({ length: 4 }, (_, i) =>
    `c3c2c3c0-5000-4d00-9000-${String(i + 1).padStart(12, "0")}`
  ),
};

const mediaAssets = [
  ["PIET Student Life", "https://apply.piet.co.in/img/student_10.jpg"],
  ["Modern Campus", "https://images.unsplash.com/photo-1564981797816-1043664bf78d?auto=format&fit=crop&w=1600&q=85"],
  ["Technology Learning", "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=85"],
  ["Future Ready Students", "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85"],
];

const contacts = [
  ["Rahul Sharma", "rahul.sharma@example.com"],
  ["Priya Verma", "priya.verma@example.com"],
  ["Aman Gupta", "aman.gupta@example.com"],
  ["Neha Singh", "neha.singh@example.com"],
  ["Rohit Kumar", "rohit.kumar@example.com"],
  ["Anjali Mishra", "anjali.mishra@example.com"],
  ["Arjun Yadav", "arjun.yadav@example.com"],
  ["Sneha Patel", "sneha.patel@example.com"],
  ["Karan Malhotra", "karan.malhotra@example.com"],
  ["Pooja Chauhan", "pooja.chauhan@example.com"],
  ["Vikas Sharma", "vikas.sharma@example.com"],
  ["Simran Kaur", "simran.kaur@example.com"],
  ["Aditya Verma", "aditya.verma@example.com"],
  ["Nisha Gupta", "nisha.gupta@example.com"],
  ["Mohit Singh", "mohit.singh@example.com"],
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

const imageSection = (id, heading, copy, image, button) => ({
  id,
  name: heading,
  type: "section",
  styles: { padding: "72px 24px", backgroundColor: "#0f172a" },
  content: [{
    id: `${id}-columns`,
    name: "Two Columns",
    type: "2Col",
    styles: { display: "flex", gap: "40px", alignItems: "center", width: "100%", maxWidth: "1180px", margin: "0 auto" },
    content: [
      {
        id: `${id}-copy-column`,
        name: "Container",
        type: "container",
        styles: { width: "55%", padding: "16px" },
        content: [
          { id: `${id}-eyebrow`, name: "Text", type: "text", styles: { color: "#38bdf8", fontSize: "14px", fontWeight: "700", letterSpacing: "2px", marginBottom: "12px" }, content: { innerText: "PIET • EDUCATION 4.0" } },
          { id: `${id}-heading`, name: "Text", type: "text", styles: { color: "#ffffff", fontSize: "42px", fontWeight: "700", lineHeight: "1.1", marginBottom: "18px" }, content: { innerText: heading } },
          { id: `${id}-copy`, name: "Text", type: "text", styles: { color: "#cbd5e1", fontSize: "18px", lineHeight: "1.7", marginBottom: "24px" }, content: { innerText: copy } },
          ...(button ? [{ id: `${id}-button`, name: "Link", type: "link", styles: { color: "#082f49", backgroundColor: "#67e8f9", padding: "14px 22px", borderRadius: "999px", fontWeight: "700" }, content: { innerText: button, href: "#enquiry" } }] : []),
        ],
      },
      {
        id: `${id}-image-column`,
        name: "Container",
        type: "container",
        styles: { width: "45%", padding: "16px" },
        content: [{ id: `${id}-image`, name: "Image", type: "image", styles: { width: "100%", height: "420px", objectFit: "cover", borderRadius: "28px", boxShadow: "0 25px 60px rgba(0,0,0,.35)" }, content: { src: image, alt: heading } }],
      },
    ],
  }],
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
          formDescription: "Share your interests and our counselling team can help you understand the next step.",
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
    const laneNames = ["New Lead", "Contacted", "Converted"];
    for (let i = 0; i < laneNames.length; i++) {
      await tx.lane.upsert({
        where: { id: ids.lanes[i] },
        update: { name: laneNames[i], order: i, color: ["#3b82f6", "#f59e0b", "#10b981"][i], pipelineId: pipeline.id },
        create: { id: ids.lanes[i], name: laneNames[i], order: i, color: ["#3b82f6", "#f59e0b", "#10b981"][i], pipelineId: pipeline.id },
      });
    }

    for (let i = 0; i < contacts.length; i++) {
      await tx.contact.upsert({ where: { id: ids.contacts[i] }, update: { name: contacts[i][0], email: contacts[i][1], subAccountId: subAccount.id }, create: { id: ids.contacts[i], name: contacts[i][0], email: contacts[i][1], subAccountId: subAccount.id } });
    }

    for (let i = 0; i < mediaAssets.length; i++) {
      await tx.media.upsert({
        where: { id: ids.media[i] },
        update: { name: mediaAssets[i][0], link: mediaAssets[i][1], type: "image", subAccountId: subAccount.id },
        create: { id: ids.media[i], name: mediaAssets[i][0], link: mediaAssets[i][1], type: "image", subAccountId: subAccount.id },
      });
    }

    for (let i = 0; i < tickets.length; i++) {
      await tx.ticket.upsert({
        where: { id: ids.tickets[i] },
        update: { name: tickets[i][0], value: tickets[i][1], laneId: ids.lanes[tickets[i][2]], customerId: ids.contacts[i % contacts.length], description: "Fictional admission enquiry for supervisor presentation.", order: i },
        create: { id: ids.tickets[i], name: tickets[i][0], value: tickets[i][1], laneId: ids.lanes[tickets[i][2]], customerId: ids.contacts[i % contacts.length], description: "Fictional admission enquiry for supervisor presentation.", order: i },
      });
    }

    const funnels = [
      { id: ids.funnels[0], name: "B.Tech Admission Enquiry", subDomainName: "piet-admission-2026", description: "Capture enquiries for B.Tech programmes and course guidance." },
      { id: ids.funnels[1], name: "Admission Counselling", subDomainName: "piet-counselling-2026", description: "Generate counselling and admission guidance enquiries." },
    ];
    for (const funnel of funnels) {
      await tx.funnel.upsert({ where: { id: funnel.id }, update: funnel, create: { ...funnel, subAccountId: subAccount.id, published: false } });
    }

    const pages = [
      [ids.funnels[0], "Home", "", body([imageSection("home-hero", "Find your direction. Build your future.", "PIET brings together engineering, management, technology and pharmacy programmes with an Education 4.0 approach focused on innovation, practical learning and industry readiness.", mediaAssets[0][1], "Explore programmes"), textSection("home-courses", "A campus built for what comes next", "Explore B.Tech, BCA, BBA, MBA, MCA, pharmacy and diploma pathways. Course availability, eligibility and fees should always be confirmed with the official institute.", "View programmes"), imageSection("home-innovation", "Learn beyond the classroom", "From the AICTE IDEA Lab and RISE incubation ecosystem to clubs, events and practical projects, students can build the confidence to turn curiosity into capability.", mediaAssets[2][1], "Talk to admissions"), formSection("home-enquiry")])],
      [ids.funnels[0], "Courses", "courses", body([textSection("courses", "Programmes for ambitious learners", "B.Tech pathways include CSE, IT, ECE, Civil, Mechanical, Textile and emerging specialisations such as AI & ML, AI & DS and Cyber Security. PIET also lists BCA, BBA, MBA, MCA, B.Pharm, D.Pharm and diploma programmes.", "Ask about a programme"), imageSection("courses-campus", "Choose a pathway with purpose", "Eligibility, scholarships and intake details vary by programme and session. Connect with the admissions team for the latest verified information.", mediaAssets[1][1], "Request course guidance")])],
      [ids.funnels[0], "Enquiry", "enquiry", body([imageSection("enquiry-intro", "Your next step starts with a conversation", "Tell us what you want to study, where you are in your journey and how you would like to be contacted. Our admissions team can guide you toward the right official information.", mediaAssets[3][1], "Send enquiry"), formSection("enquiry-form")])],
      [ids.funnels[0], "Thank You", "thank-you", body([textSection("thank-you", "Thanks — your enquiry is on its way", "We have received your enquiry. Keep your documents ready and verify all course, fee and admission details through the official PIET channels.", "Return to programmes")])],
      [ids.funnels[1], "Counselling", "", body([imageSection("counselling", "Make your admission decision with clarity", "A structured conversation can help you compare programmes, understand eligibility, prepare documents and plan the next step with confidence.", mediaAssets[3][1], "Request counselling"), textSection("counselling-process", "A simple four-step journey", "Discover your interests → shortlist programmes → understand the process → verify and apply through official channels.", "Start counselling"), formSection("counselling-form")])],
      [ids.funnels[1], "Counselling Information", "information", body([imageSection("process", "From questions to a confident shortlist", "Bring your questions about branches, career direction, scholarships, campus life or application steps. The goal is a clear, informed next action.", mediaAssets[2][1], "Register for counselling")])],
      [ids.funnels[1], "Registration", "registration", body([textSection("registration", "Reserve a counselling conversation", "Share your interests and preferred contact method. Please use fictional details for this presentation environment.", null), formSection("registration-form")])],
      [ids.funnels[1], "Confirmation", "confirmation", body([imageSection("confirmation", "You are one step closer to clarity", "Your counselling request has been recorded. The admissions team can now follow up with the information you asked for.", mediaAssets[0][1], "Back to counselling")])],
    ];
    for (let i = 0; i < pages.length; i++) {
      const [funnelId, name, pathName, content] = pages[i];
      await tx.funnelPage.upsert({ where: { id: `c3c2c3c0-4000-4d00-9000-${String(i + 1).padStart(12, "0")}` }, update: { name, pathName, order: i, content }, create: { id: `c3c2c3c0-4000-4d00-9000-${String(i + 1).padStart(12, "0")}`, funnelId, name, pathName, order: i, content } });
    }
  }, { timeout: 120000 });

  console.log(JSON.stringify({ seeded: true, contacts: contacts.length, tickets: tickets.length, funnels: 2, pages: 8, mediaAdded: mediaAssets.length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
