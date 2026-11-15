import { ACCM_COPY } from "@/content/accm-guide";
import { AccmGuide, accmMetadata } from "./accm-guide";

export const revalidate = 3600;
export const metadata = accmMetadata(ACCM_COPY);

export default function AccmPage() {
  return <AccmGuide c={ACCM_COPY} />;
}
