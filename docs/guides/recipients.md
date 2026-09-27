# Guide for Recipients

This guide explains how to apply for funding, how your award amount is determined, how tranches work, and what the payment mode means for you.

---

## Applying for funding

### 1. Submit your application

Call `programme.apply(requested, metadata_hash)` during the application window (before `application_deadline`):

```rust
programme.apply(
    applicant,
    5_000,              // How much you need
    metadata_hash       // Hash of your proposal document
)
```

**What you provide:**

- **Requested amount**: The maximum you need (in the programme's token)
- **Metadata hash**: A cryptographic fingerprint of your off-chain proposal (stored on IPFS, the programme's server, or wherever agreed)

The blockchain stores only the hash, not your full proposal. This keeps costs low while preserving auditability.

### 2. Reviewers evaluate

During the review window (between `application_deadline` and `review_deadline`), reviewers examine your proposal and call `programme.review(applicant, approved_amount)`.

Each reviewer approves an amount **up to your requested amount**. They cannot approve more than you asked for.

### 3. Your award is the median of reviewer votes

Once enough reviewers have voted (when **quorum** is reached), anyone can call `programme.finalize(applicant, payee, mode)` to settle your application into an **award**.

The awarded amount is the **median** of reviewer votes, capped at your requested amount.

---

## Why the median?

Reviewers rarely agree on an exact number. The median is robust to outliers:

- **Minimum** lets one cautious reviewer dictate the outcome
- **Mean** lets one extreme vote drag the result
- **Median** is what the committee would naturally settle on

**Example:**

You request 5,000 tokens. Three reviewers vote:
- Reviewer A: 3,000
- Reviewer B: 4,000  
- Reviewer C: 2,000

Votes in order: [2,000, 3,000, 4,000]  
**Median: 3,000** ← this is your award

If reviewer C had voted 500 instead (an outlier), the median stays 3,000. The mean would have dropped to 2,500.

### Quorum

The programme requires a **quorum** (minimum number of reviewer votes) before finalization. If quorum is 3, at least 3 reviewers must vote before your application can be finalized.

With an even number of votes, the median takes the **lower of the two middle values** (the conservative side when the number is money).

---

## Tranches: installments that unlock with proof

Your award divides into **tranches** (installments). Each tranche unlocks when you provide proof that you met a condition.

**Example:**

- Award: 3,000 tokens
- Tranches: 3  
- Per tranche: 1,000 tokens

You receive:
- 1,000 after proof of enrollment
- 1,000 after proof of mid-term completion  
- 1,000 after proof of final term completion

### How tranches release

1. A trusted **verifier** examines your evidence (attendance records, timesheets, delivery receipts, etc.)
2. The verifier calls `attest.attest()`, creating an on-chain **attestation** with a unique ID
3. You (or anyone) call `programme.release(recipient, attestation_uid, verifier)` to unlock the tranche

If the attestation is valid (not revoked, not expired, not already used), the tranche is released according to the payment mode.

### One proof per tranche

Each attestation can be used **once** per programme. If you try to reuse the same proof for another tranche, the contract rejects it with:

```
Error::AttestationAlreadyUsed (error code 22)
```

You need **separate attestations** for each tranche (e.g., one for enrollment, one for mid-term, one for final term).

### Release window

Tranches can only release during the **release window** (between `review_deadline` and `release_deadline`). After `release_deadline`, no more tranches can unlock — even with valid attestations.

---

## Payment modes: where your money goes

The programme creator chooses one of four **payment modes** when finalizing your award. The mode determines where tranches are sent and who controls spending.

### Mode 1: Direct

**Funds go straight to a verified payee** (e.g., your school, clinic, or landlord). You never hold the money.

- **Payee chosen at award time** by the programme creator
- **You do not pick** where it goes
- **Strongest enforcement**: Funds cannot be redirected

Use case: Tuition payments, rent subsidies, medical bills

### Mode 2: Allocated

**Funds held in escrow**; you direct them to verified payees later.

- **You choose which verified payee** receives each tranche
- **You choose when** to send it
- **Strongest guarantee** because it depends on nothing outside the programme contract

Call `programme.spend(recipient, payee, amount)` to move funds from your escrow to a verified payee.

Use case: You need to pay multiple suppliers (books, fees, equipment) and pick timing

### Mode 3: Restricted

**Funds sent to your smart wallet** with a **spend policy** limiting where you can send them.

- **You hold the money** in your own wallet
- **Policy signer restricts spending** to verified payees
- **Weaker than it looks**: If your wallet is misconfigured (you hold an unrestricted admin key), you can bypass the policy

Use case: You need direct access but the funder wants on-chain spending limits

**Important:** Restricted mode relies on your wallet being configured correctly. See [Choosing a Payment Mode](choosing-a-mode.md) for details.

### Mode 4: Open

**Funds sent directly to you** with no restriction.

- **You can spend anywhere**
- **Programme creator must verify** you are the intended recipient (cannot be used to pay an arbitrary address)

Use case: Cash assistance, unrestricted grants

---

## Standing: your payment and delivery record

Every release updates your **standing record** — a portable, non-transferable record of what you received and delivered.

The record contract stores:
- **Total received**: Cumulative amount you've been paid across all programmes
- **Total delivered**: Cumulative value you've delivered (as recorded by programmes that credit delivery)

### Why standing matters

Future funders can query your standing before awarding:
```rust
let record = record.get(recipient);
// Check record.received and record.delivered
```

A strong delivery record (delivered ≈ received or delivered > received) signals reliability. A weak record (received >> delivered) raises questions.

### Standing is protocol-wide

Your standing record is **not** programme-specific. It accumulates across every programme you participate in. This makes it a durable, understandable reputation signal for future funders.

### Programmes cannot lie about standing

Only contracts **authorized by the protocol registry** can write to standing records. A programme cannot inflate your delivery credit or erase bad history.

---

## Amending votes

Reviewers can change their vote by calling `programme.review()` again with a different amount, as long as your application is not yet finalized.

Once finalized, votes are locked and your award is immutable.

### How amendments affect the median

**Example:**

Initial votes: [1,000, 2,000, 3,000] → median 2,000  
Reviewer A amends 1,000 → 4,000  
New votes: [2,000, 3,000, 4,000] → median 3,000

Your award increases. This is why finalization is permissionless: anyone can call `finalize()` once quorum is reached, so reviewers cannot block you by indefinitely amending.

---

## Withdrawing your application

You can withdraw your application at any time before finalization:

```rust
programme.withdraw(applicant)
```

Once withdrawn:
- Reviewers can no longer vote on it
- It cannot be finalized
- You cannot un-withdraw (it is permanent)

Withdraw if you no longer need funding or if you are applying to a different programme instead.

---

## When finalization fails

Finalization can be rejected for several reasons:

### 1. Insufficient budget

The programme is oversubscribed: approved awards exceed available budget. Awards are settled **first finalized, first served**.

Error: `InsufficientBudget` (error code 17)

Your application remains un-finalized. If other awards are later withdrawn or if additional contributions arrive, you can try finalizing again.

### 2. Quorum not reached

Not enough reviewers have voted yet.

Error: `QuorumNotReached` (error code 13)

Wait for more reviewers to vote, then try finalizing again.

### 3. Application withdrawn

You (or someone) already withdrew your application.

Error: `ApplicationWithdrawn` (error code 12)

Withdrawal is permanent; you cannot finalize.

### 4. Wrong phase

Finalization only works during the **Settled phase** (after `review_deadline`).

Errors:
- `ApplicationsNotClosed` (error code 9) — before `application_deadline`
- `ReviewsNotClosed` (error code 10) — before `review_deadline`

Wait for the correct phase.

---

## Release failures

When you call `programme.release()` with an attestation, it can fail:

### 1. Attestation already used

You tried to reuse the same proof for another tranche.

Error: `AttestationAlreadyUsed` (error code 22)

Get a new attestation from the verifier for the next tranche.

### 2. Attestation invalid

The attestation is **revoked** or **expired**.

Error: `AttestationInvalid` (error code 21)

If revoked: The verifier discovered an error and invalidated it. Contact the verifier.  
If expired: The proof was time-limited and is now too old. Get a new attestation.

### 3. Release window closed

You tried to release after `release_deadline`.

Error: `ReleaseWindowClosed` (error code 23)

Tranches cannot unlock after this deadline. Unreleased funds become refundable to donors.

### 4. Wrong verifier or schema

The attestation was signed by a verifier or schema the programme does not trust.

Error: `AttestationInvalid` (error code 21)

Ensure the verifier is in the programme's trusted verifier list and the schema matches.

---

## Batch releases

If you have multiple attestations ready (e.g., you completed multiple milestones), you can release multiple tranches in one call:

```rust
programme.release_batch(recipient, vec![uid1, uid2, uid3], verifier)
```

This is more efficient than calling `release()` three times. If any attestation is invalid or already used, the entire batch fails.

---

## Quick reference

| Term | Meaning |
|---|---|
| **Application** | Your request for funding (requested amount + proposal hash) |
| **Quorum** | Minimum number of reviewer votes required before finalization |
| **Median** | Middle value of sorted reviewer votes (your award amount) |
| **Award** | Finalized allocation (granted amount + tranches + payee + mode) |
| **Tranche** | One installment of your award, unlocked with an attestation |
| **Attestation** | Verifier's signed proof that you met a condition |
| **Release** | Unlocking a tranche by providing a valid attestation |
| **Mode** | Payment method (Direct, Allocated, Restricted, Open) |
| **Standing** | Your cumulative received/delivered record across all programmes |

---

## Common scenarios

### Scenario 1: Fully funded, all tranches released

1. You apply for 5,000
2. Reviewers vote: [4,000, 5,000, 4,500] → median 4,500
3. Award finalized: 4,500 in 3 tranches (1,500 each)
4. You get attestation 1 → release tranche 1 ✅
5. You get attestation 2 → release tranche 2 ✅
6. You get attestation 3 → release tranche 3 ✅
7. Total received: 4,500

### Scenario 2: Partial release (missed deadline)

1. Award finalized: 3,000 in 3 tranches (1,000 each)
2. You release tranche 1 ✅
3. You release tranche 2 ✅
4. `release_deadline` passes
5. You try to release tranche 3 → rejected ❌ (release window closed)
6. Total received: 2,000 (tranche 3 stays unreleased, becomes refundable to donors)

### Scenario 3: Revoked attestation

1. You get attestation from verifier
2. Verifier discovers error and revokes it
3. You try to call `release()` → rejected ❌ (attestation invalid)
4. You provide correct evidence to verifier
5. Verifier issues new attestation
6. You call `release()` with new attestation → succeeds ✅

### Scenario 4: Oversubscribed programme

1. Budget: 10,000 tokens
2. Your award: 4,000 tokens
3. Someone else finalizes first, consuming 7,000 tokens
4. You try to finalize → rejected ❌ (only 3,000 left, insufficient for your 4,000)
5. Your application stays un-finalized
6. If other applicant withdraws, you can try again

---

## Related guides

- [Funders Guide](funders.md) — how contributions and refunds work
- [Verifiers Guide](verifiers.md) — what attestations mean and how revoking works
- [Choosing a Payment Mode](choosing-a-mode.md) — what each mode enforces and when to use it

---

**Note:** This guide describes the on-chain mechanics. It is not financial, tax, or legal advice.
