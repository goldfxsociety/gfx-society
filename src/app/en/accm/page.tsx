import { AccmGuide, accmMetadata } from "@/app/accm/accm-guide";
import { ACCM_COPY_EN } from "@/content/accm-guide";

export const revalidate = 3600;
export const metadata = accmMetadata(ACCM_COPY_EN);

export default function EnAccmPage() {
  return <AccmGuide c={ACCM_COPY_EN} />;
}
