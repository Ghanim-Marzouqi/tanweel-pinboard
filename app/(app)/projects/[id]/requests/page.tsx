import { RequestListPage } from '@/components/request-list-page';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <RequestListPage projectId={(await params).id} searchParams={await searchParams} />;
}
