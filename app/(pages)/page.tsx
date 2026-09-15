import Dashboard from "@/components/Dashboard";
import { parseSearchParams } from "@/components/Helper";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  return <Dashboard initialParams={parseSearchParams(params)} />;
}
