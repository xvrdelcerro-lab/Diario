import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../core/firebase";

export type Prioridad = "alta" | "media" | "baja";

export interface Subtarea {
  id: string;
  titulo: string;
  hecho: boolean;
}

// Fechas en milisegundos. fechaLimite es la medianoche local del día elegido.
export interface Pendiente {
  id: string;
  titulo: string;
  prioridad: Prioridad;
  fechaLimite: number | null;
  hecho: boolean;
  hechoEn: number | null;
  creadaEn: number;
  subtareas: Subtarea[];
}

const ref = (uid: string) => collection(db, "users", uid, "pendientes");

export function suscribirPendientes(uid: string, cb: (p: Pendiente[]) => void) {
  const q = query(ref(uid), orderBy("creadaEn", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pendiente, "id">) })))
  );
}

export function crearPendiente(
  uid: string,
  datos: Pick<Pendiente, "titulo" | "prioridad" | "fechaLimite">
) {
  return addDoc(ref(uid), {
    ...datos,
    hecho: false,
    hechoEn: null,
    creadaEn: Date.now(),
    subtareas: [],
  });
}

export function actualizarPendiente(
  uid: string,
  id: string,
  cambios: Partial<Omit<Pendiente, "id">>
) {
  return updateDoc(doc(ref(uid), id), cambios);
}

export function eliminarPendiente(uid: string, id: string) {
  return deleteDoc(doc(ref(uid), id));
}

export const nuevoIdSubtarea = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
