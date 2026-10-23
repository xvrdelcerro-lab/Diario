import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../core/firebase";

export type TipoEvento = "cita" | "cumple" | "reunion" | "plan";

// Fechas en milisegundos. Un evento de todo el día va de las 00:00 a las 23:59:59 de ese día.
export interface Evento {
  id: string;
  titulo: string;
  tipo: TipoEvento;
  inicio: number;
  fin: number;
  todoElDia: boolean;
  repiteAnual: boolean;
  notas: string;
}

// Una aparición concreta de un evento (los que se repiten tienen una por año).
export interface Ocurrencia {
  ev: Evento;
  inicio: number;
  fin: number;
}

const ref = (uid: string) => collection(db, "users", uid, "eventos");

export function suscribirEventos(uid: string, cb: (e: Evento[]) => void) {
  const q = query(ref(uid), orderBy("inicio"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Evento, "id">) })))
  );
}

// Con id actualiza el evento completo; sin id crea uno nuevo.
export function guardarEvento(uid: string, datos: Omit<Evento, "id">, id?: string) {
  return id ? setDoc(doc(ref(uid), id), datos) : addDoc(ref(uid), datos);
}

export function eliminarEvento(uid: string, id: string) {
  return deleteDoc(doc(ref(uid), id));
}

export function ocurrencias(ev: Evento, desde: number, hasta: number): Ocurrencia[] {
  const duracion = ev.fin - ev.inicio;

  if (!ev.repiteAnual) {
    return ev.inicio <= hasta && ev.fin >= desde
      ? [{ ev, inicio: ev.inicio, fin: ev.fin }]
      : [];
  }

  const base = new Date(ev.inicio);
  const salida: Ocurrencia[] = [];
  for (let y = new Date(desde).getFullYear() - 1; y <= new Date(hasta).getFullYear(); y++) {
    if (y < base.getFullYear()) continue;
    const s = new Date(base);
    s.setFullYear(y);
    const ini = s.getTime();
    if (ini <= hasta && ini + duracion >= desde) {
      salida.push({ ev, inicio: ini, fin: ini + duracion });
    }
  }
  return salida;
}
