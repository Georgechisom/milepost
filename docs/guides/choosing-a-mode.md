# Guide: Choosing a Payment Mode

This guide explains the four payment modes available when finalizing awards, what each mode enforces, what it depends on, and when to use it.

---

## The four modes

When finalizing an application into an award, the programme operator chooses one of four **payment modes**. The mode determines where tranches are sent and who controls spending.

### Overview table

| Mode | Funds go to | Recipient chooses payee? | Depends on | Strength |
|---|---|---|---|---|
| **Direct** | Verified payee | ❌ No (fixed at award time) | Programme contract only | Strong |
| **Allocated** | Escrow (recipient directs later) | ✅ Yes (from verified list) | Programme contract only | **Strongest** |
| **Restricted** | Recipient's smart wallet | ✅ Yes (policy enforced) | Wallet configuration | **Weak** |
| **Open** | Recipient | ✅ Yes (no restriction) | Programme contract only | None |

---

## Mode 1: Direct

### What it does

Funds are sent **straight to a verified payee** chosen at award time. The recipient never holds the money.

```rust
programme.finalize(applicant, school_address, Mode::Direct)
```

The `payee` (second argument) must be on the programme's verified payee list.

### Who chooses the payee

The **programme operator** (or whoever calls `finalize()`) picks the payee when the award is created. The recipient cannot change it later.

### When tranches release

Each time `programme.release()` is called with a valid attestation, the programme contract transfers funds directly to the payee.

### What it depends on

**Only the programme contract.** No external wallet configuration or policy contracts. If the attestation is valid, the transfer happens.

### Strength

**Strong.** The recipient cannot redirect funds elsewhere because they never hold them.

### When to use it

- **Institutional payments**: Tuition, rent, medical bills where the payee is fixed
- **High accountability requirements**: Funders want to ensure money reaches a specific institution
- **Recipient has no need to choose**: The payee (school, clinic, landlord) is determined at award time

---

## Mode 2: Allocated

### What it does

Funds are held in **escrow** by the programme contract. The recipient calls `programme.spend()` to direct funds to verified payees later.

```rust
programme.finalize(applicant, recipient, Mode::Allocated)
```

In this mode, the `payee` argument in `finalize()` is the recipient's address (who owns the escrow), **not** the final destination.

### Who chooses the payee

The **recipient** picks which verified payee receives funds and when.

```rust
programme.spend(recipient, supplier_address, 500)  // Send 500 to verified supplier
programme.spend(recipient, school_address, 1_000)   // Send 1,000 to verified school
```

Each call to `spend()` requires the recipient's authorization.

### When tranches release

When `programme.release()` is called, funds enter the recipient's escrow balance (held by the programme contract). The recipient then calls `spend()` to move funds out.

### What it depends on

**Only the programme contract.** No external wallet configuration. The programme contract enforces that `spend()` can only send to verified payees.

### Strength

**Strongest.** Enforcement depends on nothing outside the programme contract. No wallet misconfiguration can weaken it.

### When to use it

- **Multiple payees**: Recipient needs to pay several suppliers (books, equipment, fees) from one award
- **Flexible timing**: Recipient wants to control when payments go out
- **Maximum enforcement**: Funders want the strongest guarantee that funds only reach verified destinations

**This is the safest mode** when you want restriction and flexibility together.

---

## Mode 3: Restricted

### What it does

Funds are sent to the recipient's **smart wallet**, where a **policy signer** limits onward spending to verified payees.

```rust
programme.finalize(applicant, recipient_wallet, Mode::Restricted)
```

The recipient's wallet must have the `policy_spend` contract installed as a policy signer.

### Who chooses the payee

The **recipient** chooses, subject to:
- The payee must be on the policy's **allowlist** (set by the programme steward, not the recipient)
- The recipient cannot spend more than the **cap** in each time window

### When tranches release

When `programme.release()` is called, funds are transferred to the recipient's smart wallet. The wallet's policy signer enforces spending rules.

### What it depends on

1. **The smart wallet** must have `policy_spend` installed as a signer
2. **The wallet's `SignerLimits`** must confine the policy signer to token transfers only
3. **The recipient must not hold an unrestricted admin key** that can bypass the policy

### Strength

**Weak.** This mode is weaker than it looks.

#### Why Restricted is weaker than it looks

A policy signer constrains **one signer**, not the wallet itself. If the recipient holds an **unrestricted admin key** (or any key with `SignerLimits(None)`), they can:

1. Call `wallet.add_signer()` to add a new unrestricted Ed25519 key
2. Use that key to transfer funds anywhere, bypassing the policy entirely

The wallet would **look** restricted (policy signer is installed) but would **not be** restricted (admin key overrides it).

#### Genuine enforcement requires

For Restricted mode to actually restrict, the recipient must hold **no admin-capable signer**. The programme operator (or a multisig) must hold the admin key, and the recipient must hold only the policy signer with token-only limits:

```json
SignerLimits: { token_address -> null }
```

This is a **deployment step** the programme contract cannot perform or verify. The contract only checks that `policy_spend.is_installed(wallet)` returns true before releasing a tranche. It cannot read the wallet's `SignerLimits` or detect if an unrestricted signer also exists.

#### Misconfiguration blast radius

A misconfigured wallet is bounded to **one tranche**, not the entire award. The `is_installed()` check happens on every `release()` call, so if the policy is removed, later tranches fail.

### When to use it

- **Recipient must hold the funds** (e.g., regulatory requirement, banking integration)
- **Funder accepts the deployment risk** of wallet configuration
- **Operator controls the wallet admin key** (not the recipient)

**Do not use Restricted if:**
- You want the strongest enforcement → use **Allocated** instead
- The recipient controls the wallet admin key → restriction is cosmetic
- Wallet configuration is uncertain → use **Allocated** or **Direct**

---

## Mode 4: Open

### What it does

Funds are sent **directly to the recipient** with **no restriction**.

```rust
programme.finalize(applicant, recipient, Mode::Open)
```

### Who chooses the payee

The **recipient** chooses. They can spend anywhere.

### When tranches release

When `programme.release()` is called, funds are transferred to the recipient's address. The award is spent at that point.

### What it depends on

**Only the programme contract.** No external dependencies.

### Strength

**None.** Nothing enforces the destination.

### Why the payee is still pinned

Even though spending is unrestricted, `finalize()` still requires the `payee` argument to be the **recipient** (the applicant's address). This prevents an `Open` award from being used to pay an arbitrary address the programme never verified.

```rust
// ✅ Allowed: payee is the recipient
programme.finalize(applicant, applicant, Mode::Open)

// ❌ Rejected: payee is someone else
programme.finalize(applicant, random_address, Mode::Open)
```

This ensures the programme creator explicitly approved the recipient, even if onward spending is unrestricted.

### When to use it

- **Cash assistance**: Recipient needs unrestricted funds (food, transport, emergencies)
- **Trust-based grants**: Funder trusts recipient's judgment on spending
- **No verified payees available**: Programme cannot vet destinations in advance

---

## Comparison: Allocated vs Restricted

Both modes let the recipient choose payees. Why is one stronger?

| Property | Allocated | Restricted |
|---|---|---|
| **Enforcement location** | Programme contract (on-chain) | Wallet configuration (deployment-time) |
| **Can recipient bypass?** | ❌ No (contract enforces payee list) | ⚠️ Yes (if they hold admin key) |
| **Can be misconfigured?** | ❌ No | ✅ Yes (wrong `SignerLimits`, admin key present) |
| **Blast radius of misconfiguration** | N/A | One tranche (not entire award) |
| **Flexibility** | Recipient calls `spend()` | Recipient uses any wallet interface |
| **Depends on external state?** | ❌ No | ✅ Yes (wallet signer configuration) |

**Use Allocated when enforcement matters more than where funds are held.**  
**Use Restricted only when the recipient must hold funds and you control the wallet admin key.**

---

## Mode selection decision tree

```
START: Does the recipient need to hold the funds?
│
├─ NO → Does the recipient need to choose the payee?
│   │
│   ├─ NO → Use DIRECT
│   │       (Fixed payee, strong enforcement)
│   │
│   └─ YES → Use ALLOCATED
│           (Escrow, recipient directs, strongest enforcement)
│
└─ YES → Is there a reason they must hold the funds?
    │     (Regulatory, banking, local requirements)
    │
    ├─ NO → Use ALLOCATED instead
    │       (Holding funds is not required, get stronger enforcement)
    │
    └─ YES → Do you control the wallet admin key?
        │
        ├─ NO → DO NOT USE RESTRICTED
        │       (Restriction is cosmetic; use Open or rethink design)
        │
        └─ YES → Use RESTRICTED
                (Policy signer enforces, you hold admin key)
```

---

## Technical: how each mode is enforced

### Direct enforcement

```rust
// In programme.release():
assert!(allowed_payees.contains(&award.payee));
token.transfer(&env.current_contract_address(), &award.payee, tranche_amount);
```

Contract holds funds and transfers directly. Recipient never touches them.

### Allocated enforcement

```rust
// In programme.release():
escrow[recipient] += tranche_amount;

// In programme.spend():
recipient.require_auth();
assert!(allowed_payees.contains(&payee));
assert!(escrow[recipient] >= amount);
escrow[recipient] -= amount;
token.transfer(&env.current_contract_address(), &payee, amount);
```

Contract holds funds in an escrow map. `spend()` checks payee is verified.

### Restricted enforcement

```rust
// In programme.release():
assert!(policy_spend.is_installed(&award.payee));  // Bounds misconfiguration to one tranche
token.transfer(&env.current_contract_address(), &award.payee, tranche_amount);

// Separately, in the recipient's wallet:
// When recipient tries to spend, wallet.__check_auth() calls policy_spend.policy__(),
// which checks payee is on allowlist and cap not exceeded.
```

Enforcement is **split**: programme contract transfers to wallet, wallet policy enforces spending.

### Open enforcement

```rust
// In programme.release():
assert!(award.payee == recipient);  // Pins payee to the applicant
token.transfer(&env.current_contract_address(), &award.payee, tranche_amount);
```

No spending restriction. Payee must be the recipient (cannot redirect to arbitrary address).

---

## What verifying payees means

In **Direct**, **Allocated**, and **Restricted** modes, the programme creator calls `programme.allow_payee(address)` to build a list of verified destinations.

### Verification is cryptographic, not legal

✅ The contract **enforces** that funds only reach verified addresses  
✅ The creator **explicitly approved** each address  
❌ Verification does **not** mean the payee is legally registered, background-checked, or legitimate

Verification is a technical control: it prevents redirection to arbitrary addresses. It does not substitute for due diligence on the payee's identity.

---

## Common mistakes

### Mistake 1: Using Restricted when Allocated is stronger

**Wrong reasoning:** "Recipient needs to choose payees, so use Restricted."

**Correct:** Allocated also lets the recipient choose payees, and it is stronger because enforcement depends only on the programme contract.

**When Restricted makes sense:** Recipient **must hold funds** for a non-technical reason (regulatory, banking) **and** you control the wallet admin key.

### Mistake 2: Using Restricted with recipient holding admin key

**Result:** Restriction is cosmetic. Recipient can add an unrestricted signer and bypass the policy.

**Fix:** Operator holds the wallet admin key, recipient holds only the policy signer.

### Mistake 3: Using Open when enforcement is required

**Wrong reasoning:** "We trust the recipient."

**Correct:** If the programme requires funds reach specific destinations, use **Direct** or **Allocated**. Trust is not on-chain enforcement.

### Mistake 4: Not checking wallet configuration before using Restricted

**Result:** Policy is installed, but wallet also has an unrestricted signer. Funds released, recipient bypasses policy immediately.

**Fix:** Audit the wallet's signer list and `SignerLimits` **before** finalizing the award. If misconfigured, fix the wallet or use **Allocated** instead.

---

## Changing modes

**Modes cannot be changed after finalization.** Once an award is created with a mode, it is immutable.

If you discover the mode is wrong:
1. **Before any tranches release**: Creator can cancel the programme, refund donors, and restart with the correct mode
2. **After tranches release**: No reversal is possible. Later tranches will continue under the original mode.

Plan the mode carefully before calling `finalize()`.

---

## Quick reference

| Mode | Enforcement | Dependencies | Recipient holds funds? | Recipient chooses payee? |
|---|---|---|---|---|
| **Direct** | Strong | Contract only | ❌ | ❌ |
| **Allocated** | **Strongest** | Contract only | ❌ (in escrow) | ✅ |
| **Restricted** | **Weak** | Wallet config | ✅ | ✅ (policy-limited) |
| **Open** | None | Contract only | ✅ | ✅ (unrestricted) |

---

## Related guides

- [Funders Guide](funders.md) — how contributions and refunds work
- [Verifiers Guide](verifiers.md) — what attestations release
- [Recipients Guide](recipients.md) — how awards and tranches work

---

## Further reading

- [`docs/restricted-mode.md`](../restricted-mode.md) — Deep dive into wallet configuration, `SignerLimits`, and the trust model for Restricted mode

---

**Note:** This guide describes the on-chain mechanics. It is not legal or compliance advice. Consult appropriate professionals for regulatory implications of holding funds.
