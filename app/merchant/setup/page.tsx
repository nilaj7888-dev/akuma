import { redirect } from "next/navigation";
import { MerchantSetup } from "@/components/merchant-setup";
import { getSession } from "@/lib/auth";

export default async function MerchantSetupPage() {
  if (!await getSession()) redirect("/");
  return <MerchantSetup />;
}
