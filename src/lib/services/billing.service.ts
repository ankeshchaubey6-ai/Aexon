import { db } from "@/lib/db";

type AgencyLike = {
  id?: string | null;
  connectAccountId?: string | null;
  customerId?: string | null;
};

class BillingService {
  // FULL UNLOCK MODE (change to false later to lock features)
  private fullUnlock = true;

  private isFullUnlock() {
    return this.fullUnlock;
  }

  async ensureFreeSubscription(agencyId: string) {
    if (!agencyId) return null;

    const existing = await db.subscription.findUnique({
      where: { agencyId },
    });

    if (existing) return existing;

    return db.subscription.create({
      data: {
        agencyId,
        active: true,
        plan: null,
        priceId: "FREE_PLAN",
        price: "0",
        customerId: `free_${agencyId}`,
        subscritiptionId: `free_sub_${agencyId}`,
        currentPeriodEndDate: new Date("2099-12-31"),
      },
    });
  }

  // 🔥 FIX: Dashboard blocker (your error was here)
  shouldBlockDashboard(agency: AgencyLike | null | undefined) {
    // Full unlock → never block dashboard
    if (this.isFullUnlock()) return false;

    // Future logic when you enable paid plans
    if (!agency) return true;

    return !Boolean(
      agency.customerId && agency.customerId.trim() !== ""
    );
  }

  // Used across app for feature gating
  shouldBlockFeatures(agency?: AgencyLike | null) {
    if (this.isFullUnlock()) return false;

    if (!agency) return true;

    return !Boolean(
      agency.customerId && agency.customerId.trim() !== ""
    );
  }

  hasSubscription(agency?: AgencyLike | null) {
    if (this.isFullUnlock()) return true;

    if (!agency) return false;

    return Boolean(
      agency.customerId && agency.customerId.trim() !== ""
    );
  }

  // Platform wallet model (Flow A)
  calculatePlatformFee(amount: number) {
    return amount * 0.01; // 1% fee
  }

  calculateAgencyEarnings(amount: number) {
    const fee = this.calculatePlatformFee(amount);
    return amount - fee;
  }
}

export const billingService = new BillingService();