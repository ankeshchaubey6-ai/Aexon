import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const userEmail = process.env.DEMO_TARGET_EMAIL;
const subAccountId = process.env.DEMO_TARGET_SUBACCOUNT_ID;
const asset = (name) => `/assets/piet-counselling/${name}`;

const id = (n) => `c3c2c3c0-6000-4d00-9000-${String(n).padStart(12, "0")}`;

const text = (key, value, styles = {}) => ({
  id: key,
  name: "Text",
  type: "text",
  styles: { color: "#10243e", ...styles },
  content: { innerText: value },
});

const link = (key, label, href = "#enquiry") => ({
  id: key,
  name: "Link",
  type: "link",
  styles: { display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#ffffff", backgroundColor: "#0c7a4d", padding: "14px 22px", borderRadius: "999px", fontWeight: "800", letterSpacing: ".2px", boxShadow: "0 12px 26px rgba(12,122,77,.18)", transition: "transform .25s ease, box-shadow .25s ease" },
  content: { innerText: label, href },
});

const image = (key, src, alt) => ({
  id: key,
  name: "Image",
  type: "image",
  styles: { width: "100%", height: "360px", objectFit: "cover", borderRadius: "22px", boxShadow: "0 24px 56px rgba(9,48,34,.16)", transition: "transform .45s ease, box-shadow .45s ease" },
  content: { src, alt },
});

const container = (key, children, styles = {}) => ({
  id: key,
  name: "Container",
  type: "container",
  styles: { width: "100%", maxWidth: "1180px", margin: "0 auto", padding: "20px", ...styles },
  content: children,
});

const section = (key, children, styles = {}) => ({
  id: key,
  name: "Section",
  type: "section",
  styles: { padding: "68px 24px", backgroundColor: "#ffffff", ...styles },
  content: [container(`${key}-container`, children)],
});

const split = (key, left, right, styles = {}) => ({
  id: key,
  name: "Two Column Feature",
  type: "2Col",
  styles: { display: "flex", gap: "34px", alignItems: "center", width: "100%", maxWidth: "1180px", margin: "0 auto", ...styles },
  content: [container(`${key}-left`, left, { width: "52%" }), container(`${key}-right`, right, { width: "48%" })],
});

const card = (key, title, copy, accent = "#0c5b8f") => container(key, [
  text(`${key}-title`, title, { color: accent, fontSize: "21px", fontWeight: "700", marginBottom: "12px" }),
  text(`${key}-copy`, copy, { color: "#52657a", fontSize: "15px", lineHeight: "1.65" }),
], { flex: "1 1 235px", backgroundColor: "#ffffff", border: "1px solid #dcefe3", borderTop: `4px solid ${accent}`, borderRadius: "18px", minHeight: "178px", boxShadow: "0 15px 36px rgba(9,48,34,.08)", transition: "transform .3s ease, box-shadow .3s ease" });

const contactForm = (key) => ({
  id: key,
  name: "Contact Form",
  type: "contactForm",
  styles: { backgroundColor: "#ffffff", padding: "30px", borderRadius: "22px", boxShadow: "0 24px 60px rgba(7,62,46,.16)" },
  content: {
    formTitle: "Request admission counselling",
    formDescription: "Share your name and email. Use fictional details for this private academic presentation.",
    formButton: "Submit enquiry",
  },
});

const footer = section("footer", [
  image("footer-logo", asset("piet-logo.png"), "Panipat Institute of Engineering and Technology logo", { width: "110px", height: "68px", objectFit: "contain", objectPosition: "left center", boxShadow: "none", borderRadius: "0" }),
  text("footer-address", "70, Milestone GT Road, Samalkha, Panipat, Haryana — 132102", { color: "#dbeafe", marginTop: "18px" }),
  text("footer-note", "Academic demonstration website developed as part of a student project. Not an official PIET admissions portal.", { color: "#9fb5c8", fontSize: "13px", marginTop: "18px" }),
], { backgroundColor: "#10243e", color: "#ffffff", padding: "46px 24px" });

const header = () => section("site-header", [
  container("header-shell", [
    container("brand", [
      image("site-logo", asset("piet-logo.png"), "PIET logo", { width: "78px", height: "58px", objectFit: "contain", objectPosition: "left center", boxShadow: "none", borderRadius: "0" }),
      container("brand-copy", [
        text("brand-piet", "PIET", { color: "#07543a", fontSize: "22px", fontWeight: "900", letterSpacing: "2px", padding: "0" }),
        text("brand-name", "PANIPAT INSTITUTE OF ENGINEERING & TECHNOLOGY", { color: "#527264", fontSize: "9px", fontWeight: "800", letterSpacing: ".45px", padding: "0" }),
      ], { padding: "0", marginLeft: "8px" }),
    ], { display: "flex", alignItems: "center", width: "310px", padding: "0" }),
    container("header-nav", [
      link("nav-home", "HOME", "/", { color: "#1f4a3a", backgroundColor: "transparent", boxShadow: "none", padding: "9px 11px", fontSize: "12px" }),
      link("nav-about", "ABOUT", "/about", { color: "#1f4a3a", backgroundColor: "transparent", boxShadow: "none", padding: "9px 11px", fontSize: "12px" }),
      link("nav-programmes", "PROGRAMMES", "/programmes", { color: "#1f4a3a", backgroundColor: "transparent", boxShadow: "none", padding: "9px 11px", fontSize: "12px" }),
      link("nav-process", "PROCESS", "/admission-process", { color: "#1f4a3a", backgroundColor: "transparent", boxShadow: "none", padding: "9px 11px", fontSize: "12px" }),
    ], { display: "flex", flex: "1 1 320px", justifyContent: "flex-end", gap: "2px", padding: "0", flexWrap: "wrap" }),
    link("header-enquire", "ENQUIRE NOW", "/enquiry", { padding: "11px 17px", fontSize: "12px" }),
  ], { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", padding: "8px 0" }),
], { backgroundColor: "#ffffff", padding: "10px 24px", borderBottom: "1px solid #e2efe7" });

const pageContent = {
  home: JSON.stringify([{
    id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f7fbf8", color: "#10243e", padding: "0", fontFamily: "Inter, Arial, sans-serif" }, content: [
      ...header(),
      section("hero", [split("hero-split", [text("hero-kicker", "PANIPAT INSTITUTE OF ENGINEERING & TECHNOLOGY", { color: "#f0b429", fontWeight: "700", letterSpacing: "2px", fontSize: "13px", marginBottom: "16px" }), text("hero-heading", "Shape your future with quality education and innovation.", { color: "#ffffff", fontSize: "46px", fontWeight: "800", lineHeight: "1.08", marginBottom: "18px" }), text("hero-copy", "Explore academic programmes, discover opportunities in engineering and technology, and take the next step towards your educational journey.", { color: "#dbeafe", fontSize: "18px", lineHeight: "1.7", marginBottom: "24px" }), link("hero-link", "Explore Programmes")], [image("hero-image", asset("student-life.jpg"), "Students at PIET campus")], { alignItems: "center" })], { backgroundColor: "#10243e", color: "#ffffff", padding: "78px 24px" }),
      section("welcome", [split("welcome-split", [text("welcome-kicker", "WELCOME TO PIET", { color: "#138a62", fontWeight: "700", letterSpacing: "1.5px" }), text("welcome-heading", "An academic environment designed for the future", { fontSize: "34px", fontWeight: "800", lineHeight: "1.15", margin: "14px 0" }), text("welcome-copy", "PIET's official admissions material presents a multidisciplinary institution focused on engineering, management, technology and pharmacy, with an Education 4.0 orientation. Verify current programme, eligibility and admission details through official PIET channels.", { color: "#52657a", fontSize: "17px", lineHeight: "1.75", marginBottom: "22px" }), link("welcome-link", "Learn about PIET")], [image("welcome-image", asset("campus-gallery-1.jpg"), "PIET campus view")])]),
      section("programmes", [text("programmes-kicker", "ACADEMIC PROGRAMMES", { color: "#138a62", fontWeight: "700", letterSpacing: "1.5px", textAlign: "center" }), text("programmes-heading", "Find the programme that fits your ambition", { fontSize: "34px", fontWeight: "800", textAlign: "center", margin: "12px 0 28px" }), container("programme-grid", [card("engineering", "Engineering & Technology", "B.Tech pathways across Computer Science, AI & Data Science, AI & Machine Learning, Cyber Security, IT, ECE, Mechanical, Civil and Textile Engineering.", "#0c5b8f"), card("management", "Management", "Explore BBA and MBA pathways for business, leadership and professional growth.", "#138a62"), card("applications", "Computer Applications", "BCA and MCA pathways for learners interested in software, data and digital systems.", "#f0b429"), card("pharmacy", "Pharmacy & Diploma", "B.Pharm, D.Pharm and Diploma in Mechanical Engineering information, subject to official confirmation.", "#b85c38")], { display: "flex", gap: "18px", flexWrap: "wrap" })]),
      section("innovation", [split("innovation-split", [image("innovation-image", asset("programme-visual-1.jpg"), "Engineering and technology learning" )], [text("innovation-kicker", "ENGINEERING & INNOVATION", { color: "#f0b429", fontWeight: "700", letterSpacing: "1.5px" }), text("innovation-heading", "Learn through ideas, practice and possibility", { color: "#ffffff", fontSize: "34px", fontWeight: "800", lineHeight: "1.15", margin: "14px 0" }), text("innovation-copy", "Explore pathways in computing, artificial intelligence, cyber security, electronics and core engineering. Programme availability and facilities must be confirmed through the official institute.", { color: "#dbeafe", fontSize: "17px", lineHeight: "1.75", marginBottom: "22px" }), link("innovation-link", "Explore engineering")])], { backgroundColor: "#0c5b8f" }),
      section("journey", [text("journey-kicker", "ADMISSION JOURNEY", { color: "#138a62", fontWeight: "700", letterSpacing: "1.5px", textAlign: "center" }), text("journey-heading", "A clearer way to take your next step", { fontSize: "34px", fontWeight: "800", textAlign: "center", margin: "12px 0 28px" }), container("journey-grid", [card("step-1", "01  Explore", "Review programmes and identify the subjects that match your goals."), card("step-2", "02  Enquire", "Send an enquiry so the counselling team understands your interests."), card("step-3", "03  Understand", "Discuss eligibility, documents and current official requirements."), card("step-4", "04  Verify", "Confirm every admission detail through official PIET channels.")], { display: "flex", gap: "18px", flexWrap: "wrap" })]),
      section("enquiry", [split("enquiry-split", [text("enquiry-kicker", "STUDENT SUPPORT", { color: "#f0b429", fontWeight: "700", letterSpacing: "1.5px" }), text("enquiry-heading", "Questions are the beginning of progress", { color: "#ffffff", fontSize: "34px", fontWeight: "800", lineHeight: "1.15", margin: "14px 0" }), text("enquiry-copy", "Ask about programme direction, academic choices and the next official step. This enquiry form is connected to Aexon's Piet Admission workspace.", { color: "#dbeafe", fontSize: "17px", lineHeight: "1.7" })], [contactForm("home-form")])], { backgroundColor: "#10243e" }),
      footer,
    ],
  }]),
  about: JSON.stringify([{ id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f5f8fb", padding: "0" }, content: [section("about-hero", [text("about-title", "About Panipat Institute of Engineering & Technology", { color: "#ffffff", fontSize: "44px", fontWeight: "800" }), text("about-copy", "An institutional introduction for students exploring academic and technology pathways.", { color: "#dbeafe", fontSize: "18px", marginTop: "16px" })], { backgroundColor: "#10243e" }), section("about-story", [split("about-story-split", [image("about-image", asset("campus-gallery-2.jpg"), "PIET campus environment")], [text("about-kicker", "INSTITUTIONAL CONTEXT", { color: "#138a62", fontWeight: "700" }), text("about-heading", "A multidisciplinary learning environment", { fontSize: "34px", fontWeight: "800", margin: "14px 0" }), text("about-text", "Official PIET references describe the institute as a multidisciplinary institution with programmes in engineering, management, computer applications, pharmacy and diploma education. This page is a student-project presentation layer; confirm current facts and procedures with PIET.", { color: "#52657a", fontSize: "17px", lineHeight: "1.75" })])]), section("about-values", [text("values-heading", "What students can explore", { fontSize: "32px", fontWeight: "800", textAlign: "center", marginBottom: "28px" }), container("values-grid", [card("value-1", "Academic direction", "Compare programmes and understand the academic path before applying."), card("value-2", "Innovation mindset", "Explore how technology, practical learning and future skills shape choices."), card("value-3", "Student support", "Use counselling to organise questions, documents and next actions.")], { display: "flex", gap: "18px", flexWrap: "wrap" })]), footer] }]),
  programmes: JSON.stringify([{ id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f5f8fb", padding: "0" }, content: [section("programme-hero", [text("programme-title", "Academic Programmes", { color: "#ffffff", fontSize: "44px", fontWeight: "800" }), text("programme-copy", "Discover engineering, management, computer applications, pharmacy and diploma pathways.", { color: "#dbeafe", fontSize: "18px", marginTop: "16px" })], { backgroundColor: "#0c5b8f" }), section("programme-list", [text("programme-list-heading", "Explore by academic area", { fontSize: "34px", fontWeight: "800", textAlign: "center", marginBottom: "28px" }), container("programme-list-grid", [card("btech", "B.Tech & B.Tech specialisations", "Computer Science and Engineering, AI & Data Science, AI & Machine Learning, Cyber Security, Information Technology, ECE, Mechanical, Civil and Textile Engineering."), card("bba-mba", "BBA & MBA", "Management pathways listed in PIET's official admissions material. Confirm current specialisations and eligibility with the institute."), card("bca-mca", "BCA & MCA", "Computer application programmes for undergraduate and postgraduate learners."), card("pharmacy-diploma", "Pharmacy & Diploma", "B.Pharm, D.Pharm and Diploma in Mechanical Engineering pathways, subject to official confirmation.")], { display: "flex", gap: "18px", flexWrap: "wrap" })]), section("programme-visual", [split("programme-visual-split", [text("programme-visual-heading", "Choose with context, not guesswork", { color: "#ffffff", fontSize: "34px", fontWeight: "800" }), text("programme-visual-copy", "Use counselling to connect your interests, current qualification and preferred learning direction to the right official programme information.", { color: "#dbeafe", fontSize: "17px", lineHeight: "1.7", margin: "18px 0" }), link("programme-visual-link", "Request guidance")], [image("programme-visual-image", asset("programme-visual-2.jpg"), "Students learning together")])], { backgroundColor: "#10243e" }), footer] }]),
  process: JSON.stringify([{ id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f5f8fb", padding: "0" }, content: [section("process-hero", [text("process-title", "Admission Process & Student Counselling", { color: "#ffffff", fontSize: "44px", fontWeight: "800" }), text("process-copy", "A practical framework for asking the right questions and verifying the next official step.", { color: "#dbeafe", fontSize: "18px", marginTop: "16px" })], { backgroundColor: "#10243e" }), section("process-steps", [text("process-heading", "A five-part guidance journey", { fontSize: "34px", fontWeight: "800", textAlign: "center", marginBottom: "28px" }), container("process-grid", [card("process-1", "01  Explore programmes", "Start with the branches and academic areas that interest you."), card("process-2", "02  Submit an enquiry", "Share your questions and preferred contact details."), card("process-3", "03  Prepare questions", "Bring your current qualification, interests and document questions."), card("process-4", "04  Confirm eligibility", "Ask the official institute to confirm current eligibility and requirements."), card("process-5", "05  Follow official procedure", "Use official PIET channels for final application and admission instructions.")], { display: "flex", gap: "18px", flexWrap: "wrap" })]), section("process-faq", [split("faq-split", [image("faq-image", asset("campus-gallery-3.jpg"), "PIET academic environment")], [text("faq-heading", "Questions students commonly ask", { fontSize: "32px", fontWeight: "800", marginBottom: "18px" }), text("faq-copy", "Which programme fits my interests? What documents should I prepare? How do I confirm eligibility? Where should I submit an application? Use counselling to organise your questions, then verify the answers through official PIET sources.", { color: "#52657a", fontSize: "17px", lineHeight: "1.75" }), link("faq-link", "Ask a counsellor")])]), footer] }]),
  enquiry: JSON.stringify([{ id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f5f8fb", padding: "0" }, content: [section("enquiry-hero", [text("enquiry-title", "Admission Counselling Enquiry", { color: "#ffffff", fontSize: "44px", fontWeight: "800" }), text("enquiry-copy", "Tell us what you want to explore and we will help organise your next question.", { color: "#dbeafe", fontSize: "18px", marginTop: "16px" })], { backgroundColor: "#0c5b8f" }), section("enquiry-main", [split("enquiry-main-split", [text("enquiry-guidance-title", "Bring your questions", { fontSize: "32px", fontWeight: "800" }), text("enquiry-guidance-copy", "Ask about B.Tech, BCA, BBA, MBA, MCA, pharmacy or diploma pathways. Please use fictional details for this private academic presentation.", { color: "#52657a", fontSize: "17px", lineHeight: "1.75", margin: "18px 0" }), image("enquiry-campus", asset("campus-gallery-4.jpg"), "PIET campus life")], [contactForm("enquiry-form")])]), footer] }]),
  thankyou: JSON.stringify([{ id: "__body", name: "Body", type: "__body", styles: { backgroundColor: "#f5f8fb", padding: "0" }, content: [section("thanks", [text("thanks-kicker", "ENQUIRY RECEIVED", { color: "#f0b429", fontWeight: "700", letterSpacing: "2px", textAlign: "center" }), text("thanks-title", "Thank You for Your Interest!", { color: "#ffffff", fontSize: "46px", fontWeight: "800", textAlign: "center", margin: "18px 0" }), text("thanks-copy", "Your enquiry has been recorded in the Aexon workspace. Keep your questions ready and verify the next admission step through official PIET channels.", { color: "#dbeafe", fontSize: "18px", lineHeight: "1.7", textAlign: "center", maxWidth: "720px", margin: "0 auto 24px" }), link("thanks-link", "Explore Programmes", "courses")], { backgroundColor: "#10243e", minHeight: "520px" }), footer] }]),
};

async function main() {
  if (!userEmail || !subAccountId) throw new Error("Set DEMO_TARGET_EMAIL and DEMO_TARGET_SUBACCOUNT_ID locally.");
  const user = await db.user.findUnique({ where: { email: userEmail }, select: { agencyId: true } });
  if (!user?.agencyId) throw new Error("Target user or agency not found");
  const funnel = await db.funnel.findFirst({ where: { subAccountId, name: "Admission Counselling", subAccount: { agencyId: user.agencyId } }, include: { funnelPages: true } });
  if (!funnel) throw new Error("Admission Counselling funnel not found in the verified sub-account");

  const pages = [
    [funnel.funnelPages.find((p) => p.order === 4)?.id ?? id(1), "Home", "", 0, pageContent.home],
    [funnel.funnelPages.find((p) => p.order === 5)?.id ?? id(2), "About PIET", "about", 1, pageContent.about],
    [funnel.funnelPages.find((p) => p.order === 6)?.id ?? id(3), "Academic Programmes", "programmes", 2, pageContent.programmes],
    [funnel.funnelPages.find((p) => p.order === 7)?.id ?? id(4), "Admission Process", "admission-process", 3, pageContent.process],
    [id(5), "Admission Enquiry", "enquiry", 4, pageContent.enquiry],
    [id(6), "Thank You", "thank-you", 5, pageContent.thankyou],
  ];

  await db.$transaction(async (tx) => {
    for (const [pageId, name, pathName, order, content] of pages) {
      await tx.funnelPage.upsert({ where: { id: pageId }, update: { name, pathName, order, content }, create: { id: pageId, funnelId: funnel.id, name, pathName, order, content } });
    }
  }, { timeout: 120000 });

  console.log(JSON.stringify({ funnel: funnel.name, funnelId: funnel.id, pages: pages.map((p) => ({ name: p[1], path: p[2] })), localAssets: 8 }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
