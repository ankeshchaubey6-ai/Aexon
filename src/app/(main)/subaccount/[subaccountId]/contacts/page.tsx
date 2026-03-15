import React from "react";
import { redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";

import { getSubAccountWithContacts } from "@/queries/contacts";
import BlurPage from "@/components/common/BlurPage";
import { constructMetadata, formatPrice } from "@/lib/utils";

import ContactsClient from "./_components/ContactsClient";

interface SubAccountContactPageProps {
  params: { subaccountId: string | undefined };
}

const SubAccountContactPage: React.FC<SubAccountContactPageProps> = async ({
  params,
}) => {
  const { subaccountId } = params;
  if (!subaccountId) redirect("/subaccount/unauthorized");

  const contacts = await getSubAccountWithContacts(subaccountId);
  const allContacts = contacts?.contacts || [];

  const formatTotal = (tickets: { value: Decimal | null }[]) => {
    if (!tickets || !tickets.length) return null;
    const laneAmt = tickets.reduce(
      (sum, ticket) => sum + (Number(ticket.value) || 0),
      0
    );
    return formatPrice(laneAmt);
  };

  // Calculate stats for client
  const activeContacts = allContacts.filter(c => formatTotal(c.tickets) !== null).length;
  const totalValue = allContacts.reduce((sum, contact) => {
    const value = formatTotal(contact.tickets);
    return sum + (value ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : 0);
  }, 0);
  const conversionRate = allContacts.length > 0 
    ? Math.round((activeContacts / allContacts.length) * 100) 
    : 0;

  // Serialise contacts for client (Decimal → string)
  const serialised = allContacts.map((c) => {
  const total = formatTotal(c.tickets);

  return {
    id: c.id,
    name: c.name,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
    totalValue: total,
    isActive: total !== null,
  };
});

  // Serialise stats for client
  const stats = {
    totalContacts: allContacts.length,
    activeContacts,
    totalValue: formatPrice(totalValue),
    conversionRate,
  };

  return (
    <BlurPage>
      <ContactsClient
        subaccountId={subaccountId}
        subaccountName={contacts?.name ?? "Subaccount"}
        contacts={serialised}
        stats={stats}
      />
    </BlurPage>
  );
};

export default SubAccountContactPage;

export const metadata = constructMetadata({ 
  title: "Contacts - Aexon" 
});