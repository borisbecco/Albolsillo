import type { ExpenseSource } from "@prisma/client";
import { forwardAddress } from "./detected";

export function sourceDto(s: ExpenseSource) {
  return {
    id: s.id,
    kind: s.kind,
    address: s.addressCode ? forwardAddress(s.addressCode) : null,
    status: s.status,
    last_received_at: s.lastReceivedAt?.toISOString() ?? null,
    has_confirmation: !!s.confirmationCode,
  };
}
