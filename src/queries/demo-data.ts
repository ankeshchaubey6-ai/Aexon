"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma, Role } from "@prisma/client";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";

const demoClients = [
  {
    key: "dsc-learning",
    name: "DSC Learning Institute",
    email: "demo-dsc-learning@example.invalid",
    phone: "+91 98765 10001",
    address: "12 Knowledge Park",
    city: "Jaipur",
    state: "Rajasthan",
  },
  {
    key: "urban-bites",
    name: "Urban Bites Restaurant",
    email: "demo-urban-bites@example.invalid",
    phone: "+91 98765 10002",
    address: "24 Central Market",
    city: "Jaipur",
    state: "Rajasthan",
  },
  {
    key: "fitlife",
    name: "FitLife Fitness Studio",
    email: "demo-fitlife@example.invalid",
    phone: "+91 98765 10003",
    address: "8 Wellness Avenue",
    city: "Gurugram",
    state: "Haryana",
  },
  {
    key: "sharma-real-estate",
    name: "Sharma Real Estate",
    email: "demo-sharma-re@example.invalid",
    phone: "+91 98765 10004",
    address: "31 Horizon Plaza",
    city: "Noida",
    state: "Uttar Pradesh",
  },
  {
    key: "technova",
    name: "TechNova Solutions",
    email: "demo-technova@example.invalid",
    phone: "+91 98765 10005",
    address: "16 Innovation Tower",
    city: "Bengaluru",
    state: "Karnataka",
  },
] as const;

const demoContacts = [
  [
    ["Aarav Mehta", "aarav.mehta"],
    ["Diya Kapoor", "diya.kapoor"],
    ["Kabir Singh", "kabir.singh"],
    ["Mira Joshi", "mira.joshi"],
  ],
  [
    ["Rohan Verma", "rohan.verma"],
    ["Anaya Shah", "anaya.shah"],
    ["Ishaan Rao", "ishaan.rao"],
    ["Sara Nair", "sara.nair"],
  ],
  [
    ["Vivaan Gupta", "vivaan.gupta"],
    ["Aditi Menon", "aditi.menon"],
    ["Arjun Das", "arjun.das"],
    ["Tara Iyer", "tara.iyer"],
  ],
  [
    ["Reyansh Malhotra", "reyansh.malhotra"],
    ["Myra Bansal", "myra.bansal"],
    ["Dev Khanna", "dev.khanna"],
    ["Kiara Sethi", "kiara.sethi"],
  ],
  [
    ["Advik Sharma", "advik.sharma"],
    ["Ira Chawla", "ira.chawla"],
    ["Neil Fernandes", "neil.fernandes"],
    ["Zoya Kulkarni", "zoya.kulkarni"],
  ],
] as const;

const demoTickets = [
  {
    key: "dsc-admission",
    clientIndex: 0,
    contactIndex: 0,
    stage: 0,
    name: "DSC Course Admission",
    description: "Prospective learner interested in the upcoming course intake.",
    value: "15000",
  },
  {
    key: "restaurant-website",
    clientIndex: 1,
    contactIndex: 0,
    stage: 1,
    name: "Restaurant Website Development",
    description: "Website enquiry covering menu, bookings, and location pages.",
    value: "25000",
  },
  {
    key: "fitness-membership",
    clientIndex: 2,
    contactIndex: 0,
    stage: 0,
    name: "Fitness Membership Enquiry",
    description: "New enquiry for a personal training and membership package.",
    value: "8000",
  },
  {
    key: "real-estate-website",
    clientIndex: 3,
    contactIndex: 0,
    stage: 2,
    name: "Real Estate Website Project",
    description: "Qualified project for a property listings and enquiry website.",
    value: "40000",
  },
  {
    key: "technova-consultation",
    clientIndex: 4,
    contactIndex: 0,
    stage: 1,
    name: "TechNova CRM Consultation",
    description: "Discovery request for a CRM integration consultation.",
    value: "30000",
  },
  {
    key: "dsc-scholarship",
    clientIndex: 0,
    contactIndex: 1,
    stage: 0,
    name: "DSC Scholarship Enquiry",
    description: "Prospective learner asking about scholarship eligibility.",
    value: "12000",
  },
] as const;

const pipelineStages = [
  { name: "New Lead", color: "#6366F1" },
  { name: "Contacted", color: "#F59E0B" },
  { name: "Converted", color: "#10B981" },
] as const;

const demoFunnels = [
  {
    key: "course-admission",
    clientIndex: 0,
    name: "[DEMO] Course Admission Funnel",
    pageName: "[DEMO] Course Information",
    path: "demo-course-information",
  },
  {
    key: "restaurant-enquiry",
    clientIndex: 1,
    name: "[DEMO] Restaurant Table Enquiry",
    pageName: "[DEMO] Reserve a Table",
    path: "demo-reserve-a-table",
  },
  {
    key: "fitness-membership",
    clientIndex: 2,
    name: "[DEMO] Fitness Membership Funnel",
    pageName: "[DEMO] Membership Options",
    path: "demo-membership-options",
  },
] as const;

const createdRecords = {
  subAccounts: 0,
  permissions: 0,
  contacts: 0,
  pipelines: 0,
  lanes: 0,
  tags: 0,
  sidebarOptions: 0,
  tickets: 0,
  funnels: 0,
  funnelPages: 0,
};

function demoId(agencyId: string, model: string, key: string) {
  const digest = createHash("sha256")
    .update(`aexon-demo-v1:${agencyId}:${model}:${key}`)
    .digest("hex")
    .slice(0, 32);

  return `demo_${digest}`;
}

async function createIfMissing(
  existingRecord: () => Promise<{ ownerId: string } | null>,
  expectedOwnerId: string,
  createRecord: () => Promise<unknown>
) {
  const existing = await existingRecord();

  if (existing) {
    if (existing.ownerId !== expectedOwnerId) {
      throw new Error(
        "A demo record identifier is already in use by another record. No existing data was changed."
      );
    }

    return false;
  }

  await createRecord();
  return true;
}

export async function seedAgencyDemoData() {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Sign in before adding demonstration data.");
  }

  const selectUser = {
    id: true,
    email: true,
    role: true,
    agencyId: true,
    agency: { select: { id: true } },
  } as const;

  let user = await db.user.findUnique({
    where: { id: userId },
    select: selectUser,
  });

  if (!user) {
    const clerkUser = await currentUser();
    const verifiedPrimaryEmail =
      clerkUser?.id === userId &&
      clerkUser.primaryEmailAddress?.verification?.status === "verified"
        ? clerkUser.primaryEmailAddress.emailAddress
        : null;

    if (verifiedPrimaryEmail) {
      user = await db.user.findUnique({
        where: { email: verifiedPrimaryEmail },
        select: selectUser,
      });
    }
  }

  if (!user) {
    throw new Error(
      "No Aexon user profile is linked to your authenticated Clerk account. No demonstration data was created."
    );
  }

  if (!user.agencyId || !user.agency || user.agency.id !== user.agencyId) {
    throw new Error(
      "Your authenticated Clerk account has no associated agency in the database. No demonstration data was created."
    );
  }

  const agencyId = user.agencyId;

  if (user.role !== Role.AGENCY_OWNER && user.role !== Role.AGENCY_ADMIN) {
    throw new Error(
      "Only an agency owner or administrator can add demonstration data."
    );
  }

  const counts = { ...createdRecords };

  await db.$transaction(async (tx) => {
    const subAccountIds: string[] = [];
    const contactIds: string[][] = [];
    const laneIds: string[][] = [];
    const tagIds: string[][] = [];

    for (let clientIndex = 0; clientIndex < demoClients.length; clientIndex += 1) {
      const client = demoClients[clientIndex];
      const subAccountId = demoId(agencyId, "subaccount", client.key);
      const subAccountCreated = await createIfMissing(
        async () => {
          const record = await tx.subAccount.findUnique({
            where: { id: subAccountId },
            select: { agencyId: true },
          });
          return record ? { ownerId: record.agencyId } : null;
        },
        agencyId,
        () =>
          tx.subAccount.create({
            data: {
              id: subAccountId,
              name: `[DEMO] ${client.name}`,
              subAccountLogo: "",
              companyEmail: client.email,
              companyPhone: client.phone,
              goal: 5,
              address: client.address,
              city: client.city,
              zipCode: "00000",
              state: client.state,
              country: "India",
              agencyId,
              sidebarOptions: {
                create: [
                  {
                    name: "Launchpad",
                    icon: "clipboardIcon",
                    link: `/subaccount/${subAccountId}/launchpad`,
                  },
                  {
                    name: "Settings",
                    icon: "settings",
                    link: `/subaccount/${subAccountId}/settings`,
                  },
                  {
                    name: "Funnels",
                    icon: "pipelines",
                    link: `/subaccount/${subAccountId}/funnels`,
                  },
                  {
                    name: "Media",
                    icon: "database",
                    link: `/subaccount/${subAccountId}/media`,
                  },
                  {
                    name: "Automations",
                    icon: "chip",
                    link: `/subaccount/${subAccountId}/automations`,
                  },
                  {
                    name: "Pipelines",
                    icon: "flag",
                    link: `/subaccount/${subAccountId}/pipelines`,
                  },
                  {
                    name: "Contacts",
                    icon: "person",
                    link: `/subaccount/${subAccountId}/contacts`,
                  },
                  {
                    name: "Dashboard",
                    icon: "category",
                    link: `/subaccount/${subAccountId}`,
                  },
                ],
              },
            },
          })
      );

      if (subAccountCreated) counts.subAccounts += 1;
      if (subAccountCreated) counts.sidebarOptions += 8;
      subAccountIds.push(subAccountId);

      const permissionId = demoId(
        agencyId,
        "permission",
        `${client.key}:${user.id}`
      );
      const existingPermission = await tx.permissions.findUnique({
        where: { id: permissionId },
        select: { subAccountId: true, email: true },
      });

      if (existingPermission) {
        if (
          existingPermission.subAccountId !== subAccountId ||
          existingPermission.email !== user.email
        ) {
          throw new Error(
            "A demo permission identifier is already in use. No existing data was changed."
          );
        }
      } else {
        await tx.permissions.create({
          data: {
            id: permissionId,
            email: user.email,
            subAccountId,
            access: true,
          },
        });
        counts.permissions += 1;
      }

      const pipelineId = demoId(
        agencyId,
        "pipeline",
        `${client.key}:sales`
      );
      const pipelineCreated = await createIfMissing(
        async () => {
          const record = await tx.pipeline.findUnique({
            where: { id: pipelineId },
            select: { subAccountId: true },
          });
          return record ? { ownerId: record.subAccountId } : null;
        },
        subAccountId,
        () =>
          tx.pipeline.create({
            data: {
              id: pipelineId,
              name: "[DEMO] Sales Pipeline",
              subAccountId,
            },
          })
      );

      if (pipelineCreated) counts.pipelines += 1;

      const clientLaneIds: string[] = [];
      const clientTagIds: string[] = [];

      for (let index = 0; index < pipelineStages.length; index += 1) {
        const stage = pipelineStages[index];
        const laneId = demoId(
          agencyId,
          "lane",
          `${client.key}:${stage.name}`
        );
        const laneCreated = await createIfMissing(
          async () => {
            const record = await tx.lane.findUnique({
              where: { id: laneId },
              select: { pipelineId: true },
            });
            return record ? { ownerId: record.pipelineId } : null;
          },
          pipelineId,
          () =>
            tx.lane.create({
              data: {
                id: laneId,
                name: stage.name,
                pipelineId,
                order: index,
                color: stage.color,
              },
            })
        );

        if (laneCreated) counts.lanes += 1;
        clientLaneIds.push(laneId);

        const tagId = demoId(
          agencyId,
          "tag",
          `${client.key}:${stage.name}`
        );
        const tagCreated = await createIfMissing(
          async () => {
            const record = await tx.tag.findUnique({
              where: { id: tagId },
              select: { subAccountId: true },
            });
            return record ? { ownerId: record.subAccountId } : null;
          },
          subAccountId,
          () =>
            tx.tag.create({
              data: {
                id: tagId,
                name: `[DEMO] ${stage.name}`,
                color: stage.color,
                subAccountId,
              },
            })
        );

        if (tagCreated) counts.tags += 1;
        clientTagIds.push(tagId);
      }

      laneIds.push(clientLaneIds);
      tagIds.push(clientTagIds);

      const clientContactIds: string[] = [];
      const contacts = demoContacts[clientIndex];

      for (let contactIndex = 0; contactIndex < contacts.length; contactIndex += 1) {
        const [name, emailName] = contacts[contactIndex];
        const contactId = demoId(
          agencyId,
          "contact",
          `${client.key}:${emailName}`
        );
        const contactCreated = await createIfMissing(
          async () => {
            const record = await tx.contact.findUnique({
              where: { id: contactId },
              select: { subAccountId: true },
            });
            return record ? { ownerId: record.subAccountId } : null;
          },
          subAccountId,
          () =>
            tx.contact.create({
              data: {
                id: contactId,
                name: `[DEMO] ${name}`,
                email: `${emailName}@example.invalid`,
                subAccountId,
              },
            })
        );

        if (contactCreated) counts.contacts += 1;
        clientContactIds.push(contactId);
      }

      contactIds.push(clientContactIds);
    }

    for (const ticket of demoTickets) {
      const laneId = laneIds[ticket.clientIndex][ticket.stage];
      const customerId = contactIds[ticket.clientIndex][ticket.contactIndex];
      const ticketId = demoId(agencyId, "ticket", ticket.key);
      const ticketCreated = await createIfMissing(
        async () => {
          const record = await tx.ticket.findUnique({
            where: { id: ticketId },
            select: { laneId: true },
          });
          return record ? { ownerId: record.laneId } : null;
        },
        laneId,
        () =>
          tx.ticket.create({
            data: {
              id: ticketId,
              name: `[DEMO] ${ticket.name}`,
              description: ticket.description,
              value: new Prisma.Decimal(ticket.value),
              laneId,
              customerId,
              order: 0,
              tags: {
                connect: {
                  id: tagIds[ticket.clientIndex][ticket.stage],
                },
              },
            },
          })
      );

      if (ticketCreated) counts.tickets += 1;
    }

    const emptyPageContent = JSON.stringify([
      {
        id: "__body",
        name: "Body",
        type: "__body",
        styles: { backgroundColor: "white" },
        content: [],
      },
    ]);

    for (const funnel of demoFunnels) {
      const subAccountId = subAccountIds[funnel.clientIndex];
      const funnelId = demoId(agencyId, "funnel", funnel.key);
      const funnelCreated = await createIfMissing(
        async () => {
          const record = await tx.funnel.findUnique({
            where: { id: funnelId },
            select: { subAccountId: true },
          });
          return record ? { ownerId: record.subAccountId } : null;
        },
        subAccountId,
        () =>
          tx.funnel.create({
            data: {
              id: funnelId,
              name: funnel.name,
              description: "Unpublished demonstration funnel.",
              published: false,
              subAccountId,
            },
          })
      );

      if (funnelCreated) counts.funnels += 1;

      const pageId = demoId(agencyId, "funnel-page", funnel.key);
      const pageCreated = await createIfMissing(
        async () => {
          const record = await tx.funnelPage.findUnique({
            where: { id: pageId },
            select: { funnelId: true },
          });
          return record ? { ownerId: record.funnelId } : null;
        },
        funnelId,
        () =>
          tx.funnelPage.create({
            data: {
              id: pageId,
              name: funnel.pageName,
              pathName: funnel.path,
              order: 0,
              content: emptyPageContent,
              funnelId,
            },
          })
      );

      if (pageCreated) counts.funnelPages += 1;
    }
  }, { maxWait: 10_000, timeout: 20_000 });

  revalidatePath(`/agency/${agencyId}`);
  revalidatePath(`/agency/${agencyId}/all-subaccounts`);
  for (const client of demoClients) {
    const subAccountId = demoId(agencyId, "subaccount", client.key);
    revalidatePath(`/subaccount/${subAccountId}`);
    revalidatePath(`/subaccount/${subAccountId}/contacts`);
    revalidatePath(`/subaccount/${subAccountId}/funnels`);
    revalidatePath(`/subaccount/${subAccountId}/pipelines`);
  }

  return { counts };
}
