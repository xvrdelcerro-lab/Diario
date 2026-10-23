import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../core/auth";
import {
  actualizarPendiente,
  crearPendiente,
  eliminarPendiente,
  nuevoIdSubtarea,
  suscribirPendientes,
} from "./pendientes.service";
import type { Pendiente, Prioridad, Subtarea } from "./pendientes.service";
import "./pendientes.css";

const DIA = 24 * 3600000;
const SIN_FECHA = 8.64e15;
const ORDEN: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };
const ETIQUETA: Record<Prioridad, string> = { alta: "Alta", media: "Media", baja: "Baja" };

const inicioDelDia = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const aInputDia = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};
const formatoFecha = (ms: number) =>
  new Date(ms).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

type Filtro = "pendientes" | "hechos" | "todos";

export default function Pendientes() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [items, setItems] = useState<Pendiente[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [nuevaSub, setNuevaSub] = useState<Record<string, string>>({});

  const [titulo, setTitulo] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [fecha, setFecha] = useState("");

  const [desde, setDesde] = useState(aInputDia(Date.now() - 7 * DIA));
  const [hasta, setHasta] = useState(aInputDia(Date.now()));

  useEffect(() => suscribirPendientes(uid, setItems), [uid]);

  const hoy = inicioDelDia(Date.now());

  const visibles = useMemo(
    () =>
      items
        .filter((p) =>
          filtro === "todos" ? true : filtro === "hechos" ? p.hecho : !p.hecho
        )
        .sort(
          (a, b) =>
            Number(a.hecho) - Number(b.hecho) ||
            ORDEN[a.prioridad] - ORDEN[b.prioridad] ||
            (a.fechaLimite ?? SIN_FECHA) - (b.fechaLimite ?? SIN_FECHA)
        ),
    [items, filtro]
  );

  const reporte = useMemo(() => {
    const d = new Date(`${desde}T00:00:00`).getTime();
    const h = new Date(`${hasta}T23:59:59`).getTime();
    const filas = (["alta", "media", "baja"] as Prioridad[]).map((pr) => ({
      pr,
      creados: items.filter((p) => p.prioridad === pr && p.creadaEn >= d && p.creadaEn <= h).length,
      completados: items.filter(
        (p) => p.prioridad === pr && p.hechoEn !== null && p.hechoEn >= d && p.hechoEn <= h
      ).length,
    }));
    const vencidos = items.filter(
      (p) => !p.hecho && p.fechaLimite !== null && p.fechaLimite < hoy
    ).length;
    return { filas, vencidos };
  }, [items, desde, hasta, hoy]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    await crearPendiente(uid, {
      titulo: titulo.trim(),
      prioridad,
      fechaLimite: fecha ? new Date(`${fecha}T00:00:00`).getTime() : null,
    });
    setTitulo("");
    setFecha("");
  }

  const alternar = (p: Pendiente) =>
    actualizarPendiente(uid, p.id, {
      hecho: !p.hecho,
      hechoEn: p.hecho ? null : Date.now(),
    });

  const guardarSubs = (p: Pendiente, subtareas: Subtarea[]) =>
    actualizarPendiente(uid, p.id, { subtareas });

  function agregarSub(p: Pendiente) {
    const texto = (nuevaSub[p.id] ?? "").trim();
    if (!texto) return;
    guardarSubs(p, [...p.subtareas, { id: nuevoIdSubtarea(), titulo: texto, hecho: false }]);
    setNuevaSub({ ...nuevaSub, [p.id]: "" });
  }

  return (
    <div className="modulo">
      <section className="panel">
        <h2>Nuevo pendiente</h2>
        <form onSubmit={guardar} className="form">
          <label>
            ¿Qué hay que hacer?
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          </label>
          <div className="fila">
            <label>
              Prioridad
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </label>
            <label>
              Fecha límite (opcional)
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>
          <button type="submit">Agregar pendiente</button>
        </form>
      </section>

      <section className="panel">
        <div className="encabezado">
          <h2>Mis pendientes</h2>
          <div className="filtros" role="group" aria-label="Filtrar">
            {(["pendientes", "hechos", "todos"] as Filtro[]).map((f) => (
              <button
                key={f}
                className={f === filtro ? "chip activo" : "chip"}
                onClick={() => setFiltro(f)}
              >
                {f === "pendientes" ? "Por hacer" : f === "hechos" ? "Hechos" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        {visibles.length === 0 ? (
          <p className="vacio">
            {filtro === "hechos"
              ? "Aún no has completado ningún pendiente."
              : "No hay pendientes aquí. Agrega uno en el formulario."}
          </p>
        ) : (
          <ul className="tareas">
            {visibles.map((p) => {
              const vencido = !p.hecho && p.fechaLimite !== null && p.fechaLimite < hoy;
              const hechas = p.subtareas.filter((s) => s.hecho).length;
              return (
                <li key={p.id} className={p.hecho ? "tarea hecha" : "tarea"}>
                  <div className="tarea-linea">
                    <input
                      type="checkbox"
                      checked={p.hecho}
                      onChange={() => alternar(p)}
                      aria-label={`Marcar "${p.titulo}"`}
                    />
                    <div className="tarea-texto">
                      <strong>{p.titulo}</strong>
                      <small>
                        <span className={`prio prio-${p.prioridad}`}>{ETIQUETA[p.prioridad]}</span>
                        {p.fechaLimite !== null && (
                          <span className={vencido ? "vencida" : ""}>
                            {vencido ? "Venció " : "Para "}
                            {formatoFecha(p.fechaLimite)}
                          </span>
                        )}
                        {p.subtareas.length > 0 && (
                          <span>
                            {hechas} de {p.subtareas.length} subtareas
                          </span>
                        )}
                      </small>
                    </div>
                    <button
                      className="peligro"
                      onClick={() =>
                        confirm(`¿Eliminar "${p.titulo}"?`) && eliminarPendiente(uid, p.id)
                      }
                    >
                      Eliminar
                    </button>
                  </div>

                  {p.subtareas.length > 0 && (
                    <ul className="subs">
                      {p.subtareas.map((s) => (
                        <li key={s.id} className={s.hecho ? "hecha" : ""}>
                          <label className="sub-check">
                            <input
                              type="checkbox"
                              checked={s.hecho}
                              onChange={() =>
                                guardarSubs(
                                  p,
                                  p.subtareas.map((x) =>
                                    x.id === s.id ? { ...x, hecho: !x.hecho } : x
                                  )
                                )
                              }
                            />
                            {s.titulo}
                          </label>
                          <button
                            className="mini"
                            aria-label={`Quitar subtarea ${s.titulo}`}
                            onClick={() =>
                              guardarSubs(p, p.subtareas.filter((x) => x.id !== s.id))
                            }
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!p.hecho && (
                    <div className="sub-nueva">
                      <input
                        placeholder="Agregar subtarea"
                        value={nuevaSub[p.id] ?? ""}
                        onChange={(e) => setNuevaSub({ ...nuevaSub, [p.id]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && agregarSub(p)}
                      />
                      <button className="sec" onClick={() => agregarSub(p)}>
                        Agregar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Reporte por fechas</h2>
        <div className="rango">
          <label>
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Creados</th>
              <th>Completados</th>
            </tr>
          </thead>
          <tbody>
            {reporte.filas.map((f) => (
              <tr key={f.pr}>
                <td>{ETIQUETA[f.pr]}</td>
                <td>{f.creados}</td>
                <td>{f.completados}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="resumen">
          {reporte.vencidos === 0
            ? "No tienes pendientes vencidos."
            : `Tienes ${reporte.vencidos} pendiente${reporte.vencidos === 1 ? "" : "s"} vencido${reporte.vencidos === 1 ? "" : "s"} sin completar.`}
        </p>
      </section>
    </div>
  );
}
