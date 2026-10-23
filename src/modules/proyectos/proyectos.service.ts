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
// Este módulo depende del de Eventos solo para convertir un plan en evento.
import { eliminarEvento, guardarEvento } from "../eventos/eventos.service";

export type EstadoProyecto = "idea" | "programado" | "hecho";

export interface Proyecto {
  id: string;
  titulo: string;
  notas: string;
  estado: EstadoProyecto;
  eventoId: string | null; // evento del calendario, si ya se programó
  creadaEn: number;
  programadoEn: number | null;
  hechoEn: number | null;
}

const ref = (uid: string) => collection(db, "users", uid, "proyectos");

export function suscribirProyectos(uid: string, cb: (p: Proyecto[]) => void) {
  const q = query(ref(uid), orderBy("creadaEn", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Proyecto, "id">) })))
  );
}

export function crearProyecto(uid: string, datos: Pick<Proyecto, "titulo" | "notas">) {
  return addDoc(ref(uid), {
    ...datos,
    estado: "idea",
    eventoId: null,
    creadaEn: Date.now(),
    programadoEn: null,
    hechoEn: null,
  });
}

export function actualizarProyecto(
  uid: string,
  id: string,
  cambios: Partial<Omit<Proyecto, "id">>
) {
  return updateDoc(doc(ref(uid), id), cambios);
}

export function eliminarProyecto(uid: string, id: string) {
  return deleteDoc(doc(ref(uid), id));
}

// Crea (o reemplaza) el evento del plan y lo enlaza. El id del evento es fijo,
// así que programarlo dos veces no lo duplica.
export async function convertirEnEvento(
  uid: string,
  p: Proyecto,
  fecha: { inicio: number; fin: number; todoElDia: boolean }
) {
  const eventoId = `proy_${p.id}`;
  await guardarEvento(
    uid,
    {
      titulo: p.titulo,
      tipo: "plan",
      inicio: fecha.inicio,
      fin: fecha.fin,
      todoElDia: fecha.todoElDia,
      repiteAnual: false,
      notas: p.notas,
    },
    eventoId
  );
  await actualizarProyecto(uid, p.id, {
    estado: "programado",
    eventoId,
    programadoEn: Date.now(),
  });
}

// Quita el evento del calendario y devuelve el plan a la lista de ideas.
export async function volverAIdea(uid: string, p: Proyecto) {
  if (p.eventoId) await eliminarEvento(uid, p.eventoId);
  await actualizarProyecto(uid, p.id, { estado: "idea", eventoId: null, programadoEn: null });
}
