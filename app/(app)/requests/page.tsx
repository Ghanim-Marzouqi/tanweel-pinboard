import { RequestListPage } from '@/components/request-list-page';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RequestListPage searchParams={await searchParams} />;
}
