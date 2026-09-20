'use client';

import PageShell from '@/components/PageShell';
import FundraiserDailyDetailsFeed from '@/components/fundraiser/FundraiserDailyDetailsFeed';

export default function FundraiserDetailsPage() {
  return (
    <PageShell
      title="Fundraiser Details"
      subtitle="Daily prize, giveaway, and contest updates for the 2027 Lou Gehrig Day fundraiser — newest post first"
    >
      <FundraiserDailyDetailsFeed limit={100} heading="" />
    </PageShell>
  );
}
