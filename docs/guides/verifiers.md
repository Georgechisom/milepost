# Guide for Verifiers

This guide explains what you are attesting when you sign, how to check before signing, and what revoking does and does not do.

---

## What you attest

As a verifier, your signature releases real money. When you call `attest.attest()`, you are making an on-chain claim that:

> "This recipient met this condition, and I personally verified it."

The claim has four parts:

1. **Subject**: The recipient (their blockchain address)
2. **Schema**: The template defining what kind of condition this is (e.g., "term completed", "shifts worked", "delivery confirmed")
3. **Data hash**: A cryptographic fingerprint of evidence (e.g., attendance records, timesheets, delivery receipts)
4. **Attester**: You (your blockchain address)

Your attestation gets a unique identifier (**UID**) that the programme contract uses to release one tranche.

---

## One attestation unlocks exactly one tranche

Each attestation can be used **once** within a programme. If you try to release a tranche with an attestation that was already used, the contract rejects it with:

```
Error::AttestationAlreadyUsed (error code 22)
```

This is deliberate: one proof of completion should unlock one installment, not the entire award.

### Across multiple programmes

The same attestation **can** unlock tranches in **different programmes** that trust the same schema and verifier. This is intentional: if two programmes both fund the same recipient for the same term, one proof of completion can release both payments.

Within a single programme, each attestation is still single-use.

---

## How to check before signing

Before you call `attest.attest()`, verify these off-chain:

### 1. The recipient actually exists and you can reach them

Do not attest for addresses you cannot contact or verify. If the address is wrong or the person never existed, your attestation will release funds to the wrong place.

### 2. The condition was genuinely met

The blockchain cannot check whether a student attended class, a worker completed shifts, or a farmer delivered harvest. **You** check. The contract enforces that your signature is valid; it cannot enforce that your judgment is sound.

### 3. The data hash matches the evidence

Compute the hash of your evidence file (attendance log, timesheet, delivery receipt) and ensure it matches the `data_hash` you are signing. This binds your attestation to specific, auditable evidence.

### 4. The schema matches what you agreed to verify

Check that the schema UID is the one the programme creator registered for this type of condition. Signing under the wrong schema may release funds under conditions you never agreed to verify.

---

## What revoking does

If you discover your attestation was wrong, you can revoke it. Revoking stops future claims but **does NOT undo past releases**.

If the recipient already called `programme.release()` and the tranche was paid out **before** you revoked, the money does not come back. Revocation is **forward-looking** only.

---

## Related guides

- [Funders Guide](funders.md) — how contributions flow
- [Recipients Guide](recipients.md) — how awards and tranches work
- [Choosing a Payment Mode](choosing-a-mode.md) — what each mode enforces
