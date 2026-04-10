import { db, auth } from "./firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export async function logHistory(description: string, actorEmail?: string) {
  try {
    const actor = actorEmail || (auth && (auth as any).currentUser ? (auth as any).currentUser.email : null) || null;
    const finalDescription = actor ? `${actor} ${description}` : description;
    const ref = doc(collection(db, "history"));
    const createdAt = Date.now();
    const createdAtStr = new Date(createdAt).toLocaleString();
    await setDoc(ref, { id: ref.id, description: finalDescription, actor, createdAt, createdAtStr });
    return ref.id;
  } catch (err) {
    // don't block caller on history failures
    // eslint-disable-next-line no-console
    console.error("logHistory failed", err);
    return null;
  }
}
