import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../core/auth";
import {
  abrirAjusteAlarmasExactas,
  estadoAlarmasExactas,
  reprogramarAlarmas,
} from "../../core/notificaciones";
import {
  crearMedicina,
  dosisProgramadas,
  eliminarMedicina,
  finalizarMedicina,
  marcarTomada,
  suscribirMedicinas,
  suscribirTomas,
} from "./medicinas.service";
import type { Medicina, Toma } from "./medicinas.service";
import DiagnosticoAlarmas from "./DiagnosticoAlarmas";
import "./medicinas.css";

const DIA = 24 * 3600000;

const aInputFecha = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const aInputDia = (ms: number) => aInputFecha(ms).slice(0, 10);
const formatoHora = (ms: number) =>
  new Date(ms).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function Medicinas() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [meds, setMeds] = useState<Medicina[]>([]);
  const [tomasRecientes, setTomasRecientes] = useState<Toma[]>([]);
  const [ahora, setAhora] = useState(Date.now());
  const [exactas, setExactas] = useState<string>("no-aplica");

  // Formulario
  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("1 tableta");
  const [cadaHoras, setCadaHoras] = useState(8);
  const [inicio, setInicio] = useState(aInputFecha(Date.now()));

  // Reporte
  const [desde, setDesde] = useState(aInputDia(Date.now() - 7 * DIA));
  const [hasta, setHasta] = useState(aInputDia(Date.now()));
  const [tomasReporte, setTomasReporte] = useState<Toma[]>([]);

  useEffect(() => suscribirMedicinas(uid, setMeds), [uid]);

  // Reloj: refresca la lista de pendientes cada minuto.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Tomas de las últimas 48 h (para calcular lo pendiente).
  useEffect(
    () => suscribirTomas(uid, Date.now() - 2 * DIA, Date.now() + DIA, setTomasRecientes),
    [uid]
  );

  // Permiso de alarmas exactas (Android): se vuelve a revisar al regresar a la app.
  useEffect(() => {
    const revisar = () => estadoAlarmasExactas().then(setExactas).catch(() => {});
    revisar();
    document.addEventListener("visibilitychange", revisar);
    return () => document.removeEventListener("visibilitychange", revisar);
  }, []);

  // Alarmas del sistema: se reprograman cuando cambia la lista.
  useEffect(() => {
    reprogramarAlarmas(meds).catch(console.error);
  }, [meds]);

  const rango = useMemo(() => {
    const d = new Date(`${desde}T00:00:00`).getTime();
    const h = new Date(`${hasta}T23:59:59`).getTime();
    return { d, h: Math.min(h, ahora) };
  }, [desde, hasta, ahora]);

  useEffect(() => suscribirTomas(uid, rango.d, rango.h, setTomasReporte), [uid, rango]);

  const pendientes = useMemo(() => {
    const tomadas = new Set(tomasRecientes.map((t) => t.id));
    return meds
      .filter((m) => m.activa)
      .flatMap((m) =>
        dosisProgramadas(m, ahora - DIA, ahora + 60 * 60000).map((t) => ({ m, t }))
      )
      .filter(({ m, t }) => !tomadas.has(`${m.id}_${t}`))
      .sort((a, b) => a.t - b.t);
  }, [meds, tomasRecientes, ahora]);

  const reporte = useMemo(() => {
    const ids = new Set(tomasReporte.map((t) => t.id));
    return meds.map((m) => {
      const programadas = dosisProgramadas(m, rango.d, rango.h);
      const tomadas = programadas.filter((t) => ids.has(`${m.id}_${t}`)).length;
      return { m, programadas: programadas.length, tomadas };
    });
  }, [meds, tomasReporte, rango]);

  const totalProg = reporte.reduce((s, r) => s + r.programadas, 0);
  const totalTom = reporte.reduce((s, r) => s + r.tomadas, 0);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || cadaHoras <= 0) return;
    await crearMedicina(uid, {
      nombre: nombre.trim(),
      dosis: dosis.trim(),
      cadaHoras,
      horaInicio: new Date(inicio).getTime(),
    });
    setNombre("");
  }

  return (
    <div className="modulo">
      <section className="panel">
        <h2>Tomas pendientes</h2>
        {exactas !== "granted" && exactas !== "no-aplica" && (
          <div className="aviso-alarma" role="alert">
            <p>
              Para que las alarmas suenen a la hora exacta, activa «Alarmas y recordatorios» para esta
              app.
            </p>
            <button onClick={() => abrirAjusteAlarmasExactas()}>Activar</button>
          </div>
        )}
        {pendientes.length === 0 ? (
          <p className="vacio">Todo al día. Aquí aparecerán las tomas que toque marcar.</p>
        ) : (
          <ul className="lista">
            {pendientes.map(({ m, t }) => (
              <li key={`${m.id}_${t}`} className={t <= ahora ? "atrasada" : ""}>
                <div>
                  <strong>{m.nombre}</strong> · {m.dosis}
                  <small>{formatoHora(t)}</small>
                </div>
                <button onClick={() => marcarTomada(uid, m, t)}>Marcar como tomada</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Nueva medicina</h2>
        <form onSubmit={guardar} className="form">
          <label>
            Nombre del fármaco
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </label>
          <label>
            Dosis
            <input value={dosis} onChange={(e) => setDosis(e.target.value)} required />
          </label>
          <label>
            Frecuencia (cada cuántas horas)
            <input
              type="number"
              min={1}
              max={48}
              value={cadaHoras}
              onChange={(e) => setCadaHoras(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Primera toma
            <input
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              required
            />
          </label>
          <button type="submit">Guardar medicina</button>
        </form>
      </section>

      <section className="panel">
        <h2>Mis medicinas</h2>
        {meds.length === 0 ? (
          <p className="vacio">Aún no registras ninguna. Agrega la primera en el formulario.</p>
        ) : (
          <ul className="lista">
            {meds.map((m) => (
              <li key={m.id} className={m.activa ? "" : "inactiva"}>
                <div>
                  <strong>{m.nombre}</strong> · {m.dosis}
                  <small>
                    Cada {m.cadaHoras} h {m.activa ? "" : "(finalizada)"}
                  </small>
                </div>
                <div className="acciones">
                  {m.activa && (
                    <button className="sec" onClick={() => finalizarMedicina(uid, m.id)}>
                      Finalizar
                    </button>
                  )}
                  <button
                    className="peligro"
                    onClick={() =>
                      confirm(`¿Eliminar ${m.nombre}? El historial de tomas no se borra.`) &&
                      eliminarMedicina(uid, m.id)
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

      <section className="panel">
        <h2>Reporte de adherencia</h2>
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
        {totalProg === 0 ? (
          <p className="vacio">No hay tomas programadas en este rango.</p>
        ) : (
          <>
            <p className="resumen">
              <span className="cifra">{Math.round((totalTom / totalProg) * 100)}%</span>
              {totalTom} de {totalProg} tomas realizadas
            </p>
            <table>
              <thead>
                <tr>
                  <th>Medicina</th>
                  <th>Programadas</th>
                  <th>Tomadas</th>
                  <th>Adherencia</th>
                </tr>
              </thead>
              <tbody>
                {reporte
                  .filter((r) => r.programadas > 0)
                  .map((r) => (
                    <tr key={r.m.id}>
                      <td>{r.m.nombre}</td>
                      <td>{r.programadas}</td>
                      <td>{r.tomadas}</td>
                      <td>{Math.round((r.tomadas / r.programadas) * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <DiagnosticoAlarmas />
    </div>
  );
}
