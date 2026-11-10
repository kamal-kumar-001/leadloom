# Vault checkpoint

True AES-256-GCM envelope encryption: random 32-byte DEK per credential, encrypted
under the active versioned KEK with a separate nonce/tag. Both layers bind the
workspace, credential ID and provider as authenticated data. Rotation rewraps
the DEK without decrypting the credential data. Keep old KEKs until all records
are migrated and backed up. Losing KEKs loses access to the encrypted credentials.

CredentialService validates the existing SaveBYOKCredentialRequest contract,
scopes repository operations by authenticated workspace and exposes only masked
metadata. Saved keys are unverified (isValid=false) until an authorized provider
check occurs. PrismaCredentialRepository and authenticated HTTP routes are wired. Signed-session verification and read-only mutation checks exist; an identity/login issuer and complete role policy remain to be integrated. Scope parameters must come from server-authenticated
context, never a request body's tenant claim.

Temporary buffers under our control are overwritten, including on consumer
failure. This is best-effort: JS strings, consumer copies, GC and crypto-library
internals cannot be proven erased. Never log requests, key rings, decrypted
buffers or raw provider authentication errors. Do not store plaintext credentials
in job payloads. Tests generate only ephemeral synthetic keys in memory.

Encryption and cross-tenant substitution tests do not establish full application
security. Database/auth integration and a security review remain required.
