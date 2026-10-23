import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../core/firebase";

// Todas las fechas se guardan como milisegundos (Date.now()).
export interface Medicina {
  id: string;
  nombre: string;
  dosis: string; // ej. "1 tableta"
  cadaHoras: number; // ej. 8
  horaInicio: number; // primera toma
  activa: boolean;
  finalizadaEn: number | null;
}

export interface Toma {
  id: string; // `${medicinaId}_${fechaProgramada}`
  medicinaId: string;
  fechaProgramada: number;
  tomadaEn: number;
}

const HORA = 3600000;

const medsRef = (uid: string) => collection(db, "users", uid, "medicinas");
const tomasRef = (uid: string) => collection(db, "users", uid, "tomas");

export function suscribirMedicinas(uid: string, cb: (m: Medicina[]) => void) {
  const q = query(medsRef(uid), orderBy("nombre"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Medicina, "id">) })))
  );
}

export function crearMedicina(
  uid: string,
  datos: Pick<Medicina, "nombre" | "dosis" | "cadaHoras" | "horaInicio">
) {
  return addDoc(medsRef(uid), { ...datos, activa: true, finalizadaEn: null });
}

// Se conserva el historial: solo se marca como finalizada.
export function finalizarMedicina(uid: string, id: string) {
  return updateDoc(doc(medsRef(uid), id), { activa: false, finalizadaEn: Date.now() });
}

export function eliminarMedicina(uid: string, id: string) {
  return deleteDoc(doc(medsRef(uid), id));
}

// Id determinista: pulsar dos veces "tomada" no duplica el registro.
export function marcarTomada(uid: string, med: Medicina, fechaProgramada: number) {
  const id = `${med.id}_${fechaProgramada}`;
  return setDoc(doc(tomasRef(uid), id), {
    medicinaId: med.id,
    fechaProgramada,
    tomadaEn: Date.now(),
  });
}

export function suscribirTomas(
  uid: string,
  desde: number,
  hasta: number,
  cb: (t: Toma[]) => void
) {
  const q = query(
    tomasRef(uid),
    where("fechaProgramada", ">=", desde),
    where("fechaProgramada", "<=", hasta)
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Toma, "id">) })))
  );
}

// Calcula las horas programadas de una medicina dentro de un rango.
export function dosisProgramadas(med: Medicina, desde: number, hasta: number): number[] {
  const paso = med.cadaHoras * HORA;
  if (paso <= 0) return [];
  const fin = Math.min(hasta, med.finalizadaEn ?? Infinity);
  let t = med.horaInicio;
  if (t < desde) t += Math.ceil((desde - t) / paso) * paso;
  const salida: number[] = [];
  for (; t <= fin; t += paso) salida.push(t);
  return salida;
}
