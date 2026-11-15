import { BROKER_COPY } from "@/content/broker-guide";
import { BrokerGuide, brokerMetadata } from "./broker-guide";

export const metadata = brokerMetadata(BROKER_COPY);

export default function BrokerPage() {
  return <BrokerGuide c={BROKER_COPY} />;
}
