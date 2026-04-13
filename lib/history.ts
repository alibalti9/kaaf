import { db, auth } from "./firebase";
import { collection, doc, setDoc } from "firebase/firestore";

// description: main action text (e.g. "is adding product")
// actorEmail: optional explicit actor email (falls back to current auth user)
// entityName: optional subject name to include (e.g. product name)
export async function logHistory(description: string, actorEmail?: string, entityName?: string) {
  try {
    const actor = actorEmail || (auth && (auth as any).currentUser ? (auth as any).currentUser.email : null) || null;
    const base = actor ? `${actor} ${description}` : description;
    const finalDescription = entityName ? `${base} ${entityName}` : base;
    const ref = doc(collection(db, "history"));
    // createdAt should be 6 hours behind current time per request
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const now = Date.now();
    const createdAt = now - SIX_HOURS_MS;
    // createdAtStr should reflect the actual current time (not offset)
    const createdAtStr = new Date(now).toLocaleString();
    await setDoc(ref, { id: ref.id, description: finalDescription, actor, createdAt, createdAtStr, entityName: entityName || null });
    return ref.id;
  } catch (err) {
    // don't block caller on history failures
    // eslint-disable-next-line no-console
    console.error("logHistory failed", err);
    return null;
  }
}
