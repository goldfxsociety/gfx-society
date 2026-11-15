import { BrokerGuide, brokerMetadata } from "@/app/broker/broker-guide";
import { BROKER_COPY_EN } from "@/content/broker-guide";

export const metadata = brokerMetadata(BROKER_COPY_EN);

export default function EnBrokerPage() {
  return <BrokerGuide c={BROKER_COPY_EN} />;
}
