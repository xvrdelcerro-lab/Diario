import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../core/firebase";

export type TipoTransaccion = "ingreso" | "gasto";

export const CATEGORIAS = [
  "Comida",
  "Servicios",
  "Entretenimiento",
  "Salud",
  "Transporte",
  "Salario",
  "Otros",
] as const;

// Fechas en milisegundos (medianoche local del día elegido).
export interface Transaccion {
  id: string;
  monto: number; // siempre positivo; el signo lo da el tipo
  categoria: string;
  tipo: TipoTransaccion;
  fecha: number;
  nota: string;
}

// Un aporte positivo suma a la meta; uno negativo es un retiro.
export interface Aporte {
  fecha: number;
  monto: number;
}

export interface Meta {
  id: string;
  nombre: string;
  objetivo: number;
  aportes: Aporte[];
  creadaEn: number;
}

export const redondear = (n: number) => Math.round(n * 100) / 100;
export const totalAhorrado = (m: Meta) => redondear(m.aportes.reduce((s, a) => s + a.monto, 0));

const transRef = (uid: string) => collection(db, "users", uid, "transacciones");
const metasRef = (uid: string) => collection(db, "users", uid, "metas");

export function suscribirTransacciones(uid: string, cb: (t: Transaccion[]) => void) {
  const q = query(transRef(uid), orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaccion, "id">) })))
  );
}

export function crearTransaccion(uid: string, datos: Omit<Transaccion, "id">) {
  return addDoc(transRef(uid), datos);
}

export function eliminarTransaccion(uid: string, id: string) {
  return deleteDoc(doc(transRef(uid), id));
}

export function suscribirMetas(uid: string, cb: (m: Meta[]) => void) {
  const q = query(metasRef(uid), orderBy("creadaEn"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Meta, "id">) })))
  );
}

export function crearMeta(uid: string, datos: Pick<Meta, "nombre" | "objetivo">) {
  return addDoc(metasRef(uid), { ...datos, aportes: [], creadaEn: Date.now() });
}

export function eliminarMeta(uid: string, id: string) {
  return deleteDoc(doc(metasRef(uid), id));
}

// arrayUnion agrega el aporte sin pisar otros cambios hechos desde otro dispositivo.
export function aportarAMeta(uid: string, metaId: string, monto: number) {
  return updateDoc(doc(metasRef(uid), metaId), {
    aportes: arrayUnion({ fecha: Date.now(), monto }),
  });
}
