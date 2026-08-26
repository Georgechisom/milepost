import { useProgramme } from "../../hooks/useProgramme";
import { useContractRead } from "../../hooks/useContractRead";
import { Badge } from "../ui/Badge";

interface ProofSpentBadgeProps {
  attestationUid: Buffer;
}

export function ProofSpentBadge({ attestationUid }: ProofSpentBadgeProps) {
  const { client: programme } = useProgramme();

  const spentReq = useContractRead(
    () => programme.is_spent({ attestation: attestationUid }),
    [programme, attestationUid],
  );

  if (spentReq.loading) {
    return <Badge tone="neutral">...</Badge>;
  }

  if (spentReq.error) {
    return <Badge tone="neutral">Unknown</Badge>;
  }

  const isSpent = spentReq.data ?? false;

  return (
    <Badge tone={isSpent ? "neutral" : "success"}>
      {isSpent ? "Spent" : "Available"}
    </Badge>
  );
}
