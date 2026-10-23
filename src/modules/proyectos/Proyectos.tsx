import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../core/auth";
import { suscribirEventos } from "../eventos/eventos.service";
import type { Evento } from "../eventos/eventos.service";
import {
  actualizarProyecto,
  convertirEnEvento,
  crearProyecto,
  eliminarProyecto,
  suscribirProyectos,
  volverAIdea,
} from "./proyectos.service";
import type { EstadoProyecto, Proyecto } from "./proyectos.service";
import "./proyectos.css";

const ETIQUETA: Record<EstadoProyecto, string> = {
  idea: "Idea",
  programado: "En el calendario",
  hecho: "Hecho",
};
const ORDEN: Record<EstadoProyecto, number> = { idea: 0, programado: 1, hecho: 2 };

const aInputDia = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};

type Filtro = "activos" | "hechos" | "todos";

interface FormProyecto {
  id?: string;
  titulo: string;
  notas: string;
}

interface FormFecha {
  fecha: string;
  todoElDia: boolean;
  hora: string;
}

export default function Proyectos() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [form, setForm] = useState<FormProyecto>({ titulo: "", notas: "" });

  // Qué proyecto se está poniendo en el calendario y con qué fecha.
  const [programando, setProgramando] = useState<string | null>(null);
  const [fechaForm, setFechaForm] = useState<FormFecha>({
    fecha: aInputDia(Date.now() + 7 * 86400000),
    todoElDia: true,
    hora: "09:00",
  });
  const [errorFecha, setErrorFecha] = useState("");

  const [desde, setDesde] = useState(aInputDia(Date.now() - 30 * 86400000));
  const [hasta, setHasta] = useState(aInputDia(Date.now()));

  useEffect(() => suscribirProyectos(uid, setProyectos), [uid]);
  useEffect(() => suscribirEventos(uid, setEventos), [uid]);

  const eventoPorId = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);

  const visibles = useMemo(
    () =>
      proyectos
        .filter((p) =>
          filtro === "todos" ? true : filtro === "hechos" ? p.estado === "hecho" : p.estado !== "hecho"
        )
        .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || b.creadaEn - a.creadaEn),
    [proyectos, filtro]
  );

  const reporte = useMemo(() => {
    const d = new Date(`${desde}T00:00:00`).getTime();
    const h = new Date(`${hasta}T23:59:59`).getTime();
    const dentro = (ms: number | null) => ms !== null && ms >= d && ms <= h;
    return {
      creados: proyectos.filter((p) => dentro(p.creadaEn)).length,
      programados: proyectos.filter((p) => dentro(p.programadoEn)).length,
      hechos: proyectos.filter((p) => dentro(p.hechoEn)).length,
      ideas: proyectos.filter((p) => p.estado === "idea").length,
    };
  }, [proyectos, desde, hasta]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const titulo = form.titulo.trim();
    if (!titulo) return;
    if (form.id) {
      await actualizarProyecto(uid, form.id, { titulo, notas: form.notas.trim() });
    } else {
      await crearProyecto(uid, { titulo, notas: form.notas.trim() });
    }
    setForm({ titulo: "", notas: "" });
  }

  function editar(p: Proyecto) {
    setForm({ id: p.id, titulo: p.titulo, notas: p.notas });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function abrirProgramar(p: Proyecto) {
    setProgramando(p.id);
    setErrorFecha("");
  }

  async function programar(p: Proyecto) {
    if (!fechaForm.fecha) {
      setErrorFecha("Elige una fecha.");
      return;
    }
    const dia = new Date(`${fechaForm.fecha}T00:00:00`);
    let inicio = dia.getTime();
    let fin = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1).getTime() - 1;
    if (!fechaForm.todoElDia) {
      inicio = new Date(`${fechaForm.fecha}T${fechaForm.hora}`).getTime();
      fin = inicio + 3600000;
    }
    await convertirEnEvento(uid, p, { inicio, fin, todoElDia: fechaForm.todoElDia });
    setProgramando(null);
  }

  const marcarHecho = (p: Proyecto) =>
    actualizarProyecto(uid, p.id, { estado: "hecho", hechoEn: Date.now() });

  const reabrir = (p: Proyecto) =>
    actualizarProyecto(uid, p.id, {
      estado: p.eventoId ? "programado" : "idea",
      hechoEn: null,
    });

  return (
    <div className="modulo">
      <section className="panel">
        <h2>{form.id ? "Editar proyecto" : "Nuevo proyecto"}</h2>
        <form onSubmit={guardar} className="form">
          <label>
            ¿Qué quieres lograr?
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej. Viajar a Japón"
              required
            />
          </label>
          <label>
            Notas (opcional)
            <input
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Presupuesto, ideas, enlaces…"
            />
          </label>
          <div className="acciones">
            <button type="submit">{form.id ? "Guardar cambios" : "Guardar proyecto"}</button>
            {form.id && (
              <button type="button" className="sec" onClick={() => setForm({ titulo: "", notas: "" })}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="encabezado">
          <h2>Mis proyectos</h2>
          <div className="filtros" role="group" aria-label="Filtrar">
            {(["activos", "hechos", "todos"] as Filtro[]).map((f) => (
              <button
                key={f}
                className={f === filtro ? "chip activo" : "chip"}
                onClick={() => setFiltro(f)}
              >
                {f === "activos" ? "Activos" : f === "hechos" ? "Hechos" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        {visibles.length === 0 ? (
          <p className="vacio">
            {filtro === "hechos"
              ? "Todavía no has completado ningún proyecto."
              : "No hay proyectos aquí. Anota tu primera idea en el formulario."}
          </p>
        ) : (
          <ul className="proyectos">
            {visibles.map((p) => {
              const ev = p.eventoId ? eventoPorId.get(p.eventoId) : undefined;
              const eventoPerdido = p.estado === "programado" && !ev;
              return (
                <li key={p.id} className={p.estado === "hecho" ? "proyecto hecho" : "proyecto"}>
                  <div className="proyecto-cabeza">
                    <div>
                      <strong>{p.titulo}</strong>
                      <small>
                        <span className={`estado estado-${p.estado}`}>{ETIQUETA[p.estado]}</span>
                        {ev && (
                          <span>
                            {new Date(ev.inicio).toLocaleDateString("es-MX", {
                              weekday: "short",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {eventoPerdido && (
                          <span className="aviso-perdido">Se borró el evento del calendario</span>
                        )}
                      </small>
                      {p.notas && <small>{p.notas}</small>}
                    </div>
                  </div>

                  <div className="acciones">
                    {p.estado === "idea" && (
                      <button onClick={() => abrirProgramar(p)}>Poner en el calendario</button>
                    )}
                    {p.estado === "programado" && (
                      <button className="sec" onClick={() => volverAIdea(uid, p)}>
                        {eventoPerdido ? "Volver a ideas" : "Quitar del calendario"}
                      </button>
                    )}
                    {p.estado !== "hecho" && (
                      <button className="sec" onClick={() => marcarHecho(p)}>Marcar como hecho</button>
                    )}
                    {p.estado === "hecho" && (
                      <button className="sec" onClick={() => reabrir(p)}>Reabrir</button>
                    )}
                    <button className="sec" onClick={() => editar(p)}>Editar</button>
                    <button
                      className="peligro"
                      onClick={() => {
                        const aviso = p.eventoId
                          ? `¿Eliminar "${p.titulo}"? También se borrará su evento del calendario.`
                          : `¿Eliminar "${p.titulo}"?`;
                        if (!confirm(aviso)) return;
                        if (p.eventoId) volverAIdea(uid, p).then(() => eliminarProyecto(uid, p.id));
                        else eliminarProyecto(uid, p.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>

                  {programando === p.id && (
                    <div className="programar">
                      <div className="fila">
                        <label>
                          Fecha
                          <input
                            type="date"
                            value={fechaForm.fecha}
                            onChange={(e) => setFechaForm({ ...fechaForm, fecha: e.target.value })}
                          />
                        </label>
                        {!fechaForm.todoElDia && (
                          <label>
                            Hora
                            <input
                              type="time"
                              value={fechaForm.hora}
                              onChange={(e) => setFechaForm({ ...fechaForm, hora: e.target.value })}
                            />
                          </label>
                        )}
                      </div>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={fechaForm.todoElDia}
                          onChange={(e) => setFechaForm({ ...fechaForm, todoElDia: e.target.checked })}
                        />
                        Todo el día
                      </label>
                      {errorFecha && <p className="error" role="alert">{errorFecha}</p>}
                      <div className="acciones">
                        <button onClick={() => programar(p)}>Crear evento</button>
                        <button className="sec" onClick={() => setProgramando(null)}>Cancelar</button>
                      </div>
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
              <th>En este rango</th>
              <th>Proyectos</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Anotados</td><td>{reporte.creados}</td></tr>
            <tr><td>Puestos en el calendario</td><td>{reporte.programados}</td></tr>
            <tr><td>Completados</td><td>{reporte.hechos}</td></tr>
          </tbody>
        </table>
        <p className="resumen">
          {reporte.ideas === 0
            ? "No tienes ideas pendientes de programar."
            : `Tienes ${reporte.ideas} idea${reporte.ideas === 1 ? "" : "s"} sin fecha en tu lista.`}
        </p>
      </section>
    </div>
  );
}
