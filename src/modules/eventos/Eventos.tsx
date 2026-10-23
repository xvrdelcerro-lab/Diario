import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../core/auth";
import { eliminarEvento, guardarEvento, ocurrencias, suscribirEventos } from "./eventos.service";
import type { Evento, Ocurrencia, TipoEvento } from "./eventos.service";
import "./eventos.css";

const TIPOS: Record<TipoEvento, string> = {
  cita: "Cita médica",
  cumple: "Cumpleaños",
  reunion: "Reunión",
  plan: "Plan",
};
const DIAS_SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

// ---------- utilidades de fecha ----------
const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const finDia = (d: Date) => addDias(inicioDia(d), 1).getTime() - 1;
const lunes = (d: Date) => addDias(inicioDia(d), -((d.getDay() + 6) % 7));
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const aInputFecha = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const aInputDia = (ms: number) => aInputFecha(ms).slice(0, 10);
const hora = (ms: number) =>
  new Date(ms).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const fechaLarga = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const textoHora = (o: Ocurrencia) => (o.ev.todoElDia ? "Todo el día" : `${hora(o.inicio)} – ${hora(o.fin)}`);

interface FormState {
  id?: string;
  titulo: string;
  tipo: TipoEvento;
  todoElDia: boolean;
  inicio: string;
  fin: string;
  dia: string;
  repiteAnual: boolean;
  notas: string;
}

function formNuevo(dia: Date): FormState {
  const base = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 9, 0).getTime();
  return {
    titulo: "",
    tipo: "cita",
    todoElDia: false,
    inicio: aInputFecha(base),
    fin: aInputFecha(base + 3600000),
    dia: aInputDia(base),
    repiteAnual: false,
    notas: "",
  };
}

function formDesdeEvento(e: Evento): FormState {
  return {
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo,
    todoElDia: e.todoElDia,
    inicio: aInputFecha(e.inicio),
    fin: aInputFecha(e.fin),
    dia: aInputDia(e.inicio),
    repiteAnual: e.repiteAnual,
    notas: e.notas,
  };
}

export default function Eventos() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [vista, setVista] = useState<"mes" | "semana">("mes");
  const [ancla, setAncla] = useState(new Date());
  const [seleccion, setSeleccion] = useState(new Date());
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");

  const [desde, setDesde] = useState(aInputDia(Date.now() - 30 * 86400000));
  const [hasta, setHasta] = useState(aInputDia(Date.now() + 30 * 86400000));

  useEffect(() => suscribirEventos(uid, setEventos), [uid]);

  // Días que se muestran según la vista.
  const rejilla = useMemo(() => {
    if (vista === "semana") {
      const l = lunes(ancla);
      const dias = Array.from({ length: 7 }, (_, i) => addDias(l, i));
      return { dias, d: l.getTime(), h: finDia(dias[6]) };
    }
    const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
    const total = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0).getDate();
    const semanas = Math.ceil(((primero.getDay() + 6) % 7 + total) / 7);
    const ini = lunes(primero);
    const dias = Array.from({ length: semanas * 7 }, (_, i) => addDias(ini, i));
    return { dias, d: ini.getTime(), h: finDia(dias[dias.length - 1]) };
  }, [vista, ancla]);

  const visibles = useMemo(
    () =>
      eventos
        .flatMap((e) => ocurrencias(e, rejilla.d, rejilla.h))
        .sort((a, b) => a.inicio - b.inicio),
    [eventos, rejilla]
  );

  const delDia = (d: Date) =>
    visibles.filter((o) => o.inicio <= finDia(d) && o.fin >= inicioDia(d).getTime());

  const reporte = useMemo(() => {
    const d = new Date(`${desde}T00:00:00`).getTime();
    const h = new Date(`${hasta}T23:59:59`).getTime();
    const lista = eventos.flatMap((e) => ocurrencias(e, d, h)).sort((a, b) => a.inicio - b.inicio);
    const porTipo = (t: TipoEvento) => lista.filter((o) => o.ev.tipo === t).length;
    return { lista, citas: porTipo("cita"), cumples: porTipo("cumple"), reuniones: porTipo("reunion"), planes: porTipo("plan") };
  }, [eventos, desde, hasta]);

  function mover(n: number) {
    const nueva =
      vista === "mes"
        ? new Date(ancla.getFullYear(), ancla.getMonth() + n, 1)
        : addDias(ancla, 7 * n);
    setAncla(nueva);
    setSeleccion(nueva);
  }

  function irAHoy() {
    const hoy = new Date();
    setAncla(hoy);
    setSeleccion(hoy);
  }

  const titulo =
    vista === "mes"
      ? ancla.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
      : `${rejilla.dias[0].toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${rejilla.dias[6].toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    let inicio: number;
    let fin: number;
    if (form.todoElDia) {
      const d = new Date(`${form.dia}T00:00:00`);
      inicio = d.getTime();
      fin = finDia(d);
    } else {
      inicio = new Date(form.inicio).getTime();
      fin = new Date(form.fin).getTime();
      if (!(fin > inicio)) {
        setError("La hora de fin debe ser posterior al inicio.");
        return;
      }
    }
    await guardarEvento(
      uid,
      {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        inicio,
        fin,
        todoElDia: form.todoElDia,
        repiteAnual: form.repiteAnual,
        notas: form.notas.trim(),
      },
      form.id
    );
    setSeleccion(new Date(inicio));
    setAncla(new Date(inicio));
    setForm(null);
    setError("");
  }

  const cambiar = (cambios: Partial<FormState>) => setForm((f) => (f ? { ...f, ...cambios } : f));
  const hoy = new Date();

  return (
    <div className="modulo">
      <section className="panel">
        <div className="cal-barra">
          <div className="cal-nav">
            <button className="sec" onClick={() => mover(-1)} aria-label="Periodo anterior">‹</button>
            <button className="sec" onClick={irAHoy}>Hoy</button>
            <button className="sec" onClick={() => mover(1)} aria-label="Periodo siguiente">›</button>
          </div>
          <h2 className="cal-titulo">{titulo}</h2>
          <div className="filtros" role="group" aria-label="Vista">
            <button className={vista === "mes" ? "chip activo" : "chip"} onClick={() => setVista("mes")}>
              Mes
            </button>
            <button className={vista === "semana" ? "chip activo" : "chip"} onClick={() => setVista("semana")}>
              Semana
            </button>
          </div>
        </div>

        <div className="cal-cabecera" aria-hidden="true">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className={vista === "mes" ? "cal-rejilla" : "cal-rejilla semana"}>
          {rejilla.dias.map((d) => {
            const lista = delDia(d);
            const fuera = vista === "mes" && d.getMonth() !== ancla.getMonth();
            const clases = [
              "cal-dia",
              fuera ? "fuera" : "",
              mismoDia(d, hoy) ? "hoy" : "",
              mismoDia(d, seleccion) ? "elegido" : "",
            ].join(" ");
            return (
              <button
                key={d.getTime()}
                className={clases}
                onClick={() => setSeleccion(d)}
                aria-label={`${fechaLarga(d)}, ${lista.length} evento${lista.length === 1 ? "" : "s"}`}
              >
                <span className="cal-num">{d.getDate()}</span>
                {lista.slice(0, vista === "mes" ? 2 : 6).map((o) => (
                  <span key={`${o.ev.id}_${o.inicio}`} className={`ev-chip tipo-${o.ev.tipo}`}>
                    {!o.ev.todoElDia && vista === "semana" && `${hora(o.inicio)} `}
                    {o.ev.titulo}
                  </span>
                ))}
                {vista === "mes" && lista.length > 2 && (
                  <span className="ev-mas">+{lista.length - 2} más</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="encabezado">
          <h2 className="cal-titulo">{fechaLarga(seleccion)}</h2>
          <button onClick={() => { setForm(formNuevo(seleccion)); setError(""); }}>
            Agregar evento
          </button>
        </div>

        {delDia(seleccion).length === 0 ? (
          <p className="vacio">No hay eventos este día.</p>
        ) : (
          <ul className="lista">
            {delDia(seleccion).map((o) => (
              <li key={`${o.ev.id}_${o.inicio}`}>
                <div>
                  <strong>{o.ev.titulo}</strong>
                  <small>
                    <span className={`etiqueta tipo-${o.ev.tipo}`}>{TIPOS[o.ev.tipo]}</span>{" "}
                    {textoHora(o)}
                    {o.ev.repiteAnual && " · cada año"}
                  </small>
                  {o.ev.notas && <small>{o.ev.notas}</small>}
                </div>
                <div className="acciones">
                  <button className="sec" onClick={() => { setForm(formDesdeEvento(o.ev)); setError(""); }}>
                    Editar
                  </button>
                  <button
                    className="peligro"
                    onClick={() =>
                      confirm(`¿Eliminar "${o.ev.titulo}"?${o.ev.repiteAnual ? " Se borran todos los años." : ""}`) &&
                      eliminarEvento(uid, o.ev.id)
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form && (
        <section className="panel">
          <h2>{form.id ? "Editar evento" : "Nuevo evento"}</h2>
          <form onSubmit={guardar} className="form">
            <label>
              Título
              <input value={form.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} required />
            </label>
            <label>
              Tipo
              <select
                value={form.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoEvento;
                  cambiar(
                    tipo === "cumple"
                      ? { tipo, todoElDia: true, repiteAnual: true }
                      : { tipo, repiteAnual: false }
                  );
                }}
              >
                {(Object.keys(TIPOS) as TipoEvento[]).map((t) => (
                  <option key={t} value={t}>{TIPOS[t]}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.todoElDia}
                onChange={(e) => cambiar({ todoElDia: e.target.checked })}
              />
              Todo el día
            </label>
            {form.todoElDia ? (
              <label>
                Fecha
                <input type="date" value={form.dia} onChange={(e) => cambiar({ dia: e.target.value })} required />
              </label>
            ) : (
              <div className="fila">
                <label>
                  Inicio
                  <input type="datetime-local" value={form.inicio} onChange={(e) => cambiar({ inicio: e.target.value })} required />
                </label>
                <label>
                  Fin
                  <input type="datetime-local" value={form.fin} onChange={(e) => cambiar({ fin: e.target.value })} required />
                </label>
              </div>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={form.repiteAnual}
                onChange={(e) => cambiar({ repiteAnual: e.target.checked })}
              />
              Repetir cada año
            </label>
            <label>
              Notas (opcional)
              <input value={form.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="acciones">
              <button type="submit">Guardar evento</button>
              <button type="button" className="sec" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </form>
        </section>
      )}

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
        {reporte.lista.length === 0 ? (
          <p className="vacio">No hay eventos en este rango.</p>
        ) : (
          <>
            <p className="resumen">
              {reporte.lista.length} evento{reporte.lista.length === 1 ? "" : "s"}: {reporte.citas} cita
              {reporte.citas === 1 ? "" : "s"} médica{reporte.citas === 1 ? "" : "s"}, {reporte.cumples} cumpleaños,{" "}
              {reporte.reuniones} reunion{reporte.reuniones === 1 ? "" : "es"}, {reporte.planes} plan{reporte.planes === 1 ? "" : "es"}.
            </p>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.lista.map((o) => (
                    <tr key={`${o.ev.id}_${o.inicio}`}>
                      <td>
                        {new Date(o.inicio).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        {!o.ev.todoElDia && `, ${hora(o.inicio)}`}
                      </td>
                      <td>{o.ev.titulo}</td>
                      <td>{TIPOS[o.ev.tipo]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
