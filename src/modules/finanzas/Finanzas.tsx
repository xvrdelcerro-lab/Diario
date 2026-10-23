import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../core/auth";
import {
  CATEGORIAS,
  aportarAMeta,
  crearMeta,
  crearTransaccion,
  eliminarMeta,
  eliminarTransaccion,
  redondear,
  suscribirMetas,
  suscribirTransacciones,
  totalAhorrado,
} from "./finanzas.service";
import type { Meta, TipoTransaccion, Transaccion } from "./finanzas.service";
import Dona from "./Dona";
import "./finanzas.css";

// Para cambiar de moneda, edita "MXN" (por ejemplo "USD").
const MONEDA = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dinero = (n: number) => MONEDA.format(n);

const aInputDia = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};
const inicioMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const suma = (xs: number[]) => redondear(xs.reduce((s, x) => s + x, 0));

export default function Finanzas() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [mes, setMes] = useState(inicioMes(new Date()));

  // Formulario de transacción
  const [tipo, setTipo] = useState<TipoTransaccion>("gasto");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [fecha, setFecha] = useState(aInputDia(Date.now()));
  const [nota, setNota] = useState("");
  const [errorTrans, setErrorTrans] = useState("");

  // Metas
  const [metaNombre, setMetaNombre] = useState("");
  const [metaObjetivo, setMetaObjetivo] = useState("");
  const [aporte, setAporte] = useState<Record<string, string>>({});
  const [errorMeta, setErrorMeta] = useState<{ id: string; texto: string } | null>(null);

  // Reporte
  const [desde, setDesde] = useState(aInputDia(inicioMes(new Date()).getTime()));
  const [hasta, setHasta] = useState(aInputDia(Date.now()));

  useEffect(() => suscribirTransacciones(uid, setTransacciones), [uid]);
  useEffect(() => suscribirMetas(uid, setMetas), [uid]);

  // ---------- análisis mensual ----------
  const analisis = useMemo(() => {
    const ini = mes.getTime();
    const fin = new Date(mes.getFullYear(), mes.getMonth() + 1, 1).getTime() - 1;
    const delMes = transacciones.filter((t) => t.fecha >= ini && t.fecha <= fin);
    const ingresos = suma(delMes.filter((t) => t.tipo === "ingreso").map((t) => t.monto));
    const gastos = suma(delMes.filter((t) => t.tipo === "gasto").map((t) => t.monto));
    const ahorrado = suma(
      metas.flatMap((m) => m.aportes).filter((a) => a.fecha >= ini && a.fecha <= fin).map((a) => a.monto)
    );

    const porCat = new Map<string, number>();
    delMes
      .filter((t) => t.tipo === "gasto")
      .forEach((t) => porCat.set(t.categoria, (porCat.get(t.categoria) ?? 0) + t.monto));
    const categorias = [...porCat.entries()]
      .map(([nombre, total]) => ({ nombre, total: redondear(total) }))
      .sort((a, b) => b.total - a.total);

    return {
      ingresos,
      gastos,
      ahorrado,
      disponible: redondear(ingresos - gastos - ahorrado),
      categorias,
      hayMovimientos: delMes.length > 0 || ahorrado !== 0,
    };
  }, [transacciones, metas, mes]);

  // ---------- reporte por fechas ----------
  const reporte = useMemo(() => {
    const d = new Date(`${desde}T00:00:00`).getTime();
    const h = new Date(`${hasta}T23:59:59`).getTime();
    const lista = transacciones.filter((t) => t.fecha >= d && t.fecha <= h);
    const ingresos = suma(lista.filter((t) => t.tipo === "ingreso").map((t) => t.monto));
    const gastos = suma(lista.filter((t) => t.tipo === "gasto").map((t) => t.monto));
    const ahorro = suma(
      metas.flatMap((m) => m.aportes).filter((a) => a.fecha >= d && a.fecha <= h).map((a) => a.monto)
    );
    return { lista, ingresos, gastos, ahorro, disponible: redondear(ingresos - gastos - ahorro) };
  }, [transacciones, metas, desde, hasta]);

  async function guardarTransaccion(e: FormEvent) {
    e.preventDefault();
    const valor = redondear(Number(monto));
    if (!(valor > 0)) {
      setErrorTrans("Escribe un monto mayor a cero.");
      return;
    }
    await crearTransaccion(uid, {
      monto: valor,
      categoria,
      tipo,
      fecha: new Date(`${fecha}T00:00:00`).getTime(),
      nota: nota.trim(),
    });
    setMonto("");
    setNota("");
    setErrorTrans("");
  }

  async function guardarMeta(e: FormEvent) {
    e.preventDefault();
    const objetivo = redondear(Number(metaObjetivo));
    if (!metaNombre.trim() || !(objetivo > 0)) return;
    await crearMeta(uid, { nombre: metaNombre.trim(), objetivo });
    setMetaNombre("");
    setMetaObjetivo("");
  }

  async function moverDinero(m: Meta, signo: 1 | -1) {
    const valor = redondear(Number(aporte[m.id] ?? ""));
    if (!(valor > 0)) {
      setErrorMeta({ id: m.id, texto: "Escribe un monto mayor a cero." });
      return;
    }
    if (signo < 0 && valor > totalAhorrado(m)) {
      setErrorMeta({ id: m.id, texto: "No puedes retirar más de lo que has ahorrado." });
      return;
    }
    setErrorMeta(null);
    await aportarAMeta(uid, m.id, signo * valor);
    setAporte({ ...aporte, [m.id]: "" });
  }

  const tituloMes = mes.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  return (
    <div className="modulo">
      {/* ---------- Análisis mensual ---------- */}
      <section className="panel">
        <div className="encabezado">
          <h2>Análisis mensual</h2>
          <div className="mes-nav">
            <button
              className="sec"
              aria-label="Mes anterior"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <strong className="mes-titulo">{tituloMes}</strong>
            <button
              className="sec"
              aria-label="Mes siguiente"
              onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
        </div>

        {!analisis.hayMovimientos ? (
          <p className="vacio">No hay movimientos en este mes. Registra un ingreso o un gasto abajo.</p>
        ) : (
          <>
            <div className="saldo">
              <span>Saldo disponible</span>
              <strong className={analisis.disponible < 0 ? "negativo" : "positivo"}>
                {dinero(analisis.disponible)}
              </strong>
              <small>Ingresos − gastos − ahorro del mes</small>
              {analisis.disponible < 0 && (
                <small className="negativo">Este mes gastaste más de lo que entró.</small>
              )}
            </div>

            <Dona
              ingresos={analisis.ingresos}
              gastos={analisis.gastos}
              ahorro={analisis.ahorrado}
              centroTitulo="Disponible"
              centroValor={dinero(analisis.disponible)}
              formato={dinero}
            />

            {analisis.categorias.length > 0 && (
              <>
                <h3>En qué gastaste</h3>
                <div className="barras">
                  {analisis.categorias.map((c) => (
                    <div className="barra-fila" key={c.nombre}>
                      <span>{c.nombre}</span>
                      <div className="barra-pista">
                        <div
                          className="barra gasto"
                          style={{ width: `${(c.total / analisis.gastos) * 100}%` }}
                        />
                      </div>
                      <span className="barra-valor">
                        {dinero(c.total)} · {Math.round((c.total / analisis.gastos) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ---------- Registro de transacciones ---------- */}
      <section className="panel">
        <h2>Nueva transacción</h2>
        <form onSubmit={guardarTransaccion} className="form">
          <div className="segmento" role="group" aria-label="Tipo">
            <button
              type="button"
              className={tipo === "gasto" ? "chip activo" : "chip"}
              onClick={() => setTipo("gasto")}
            >
              Gasto
            </button>
            <button
              type="button"
              className={tipo === "ingreso" ? "chip activo" : "chip"}
              onClick={() => setTipo("ingreso")}
            >
              Ingreso
            </button>
          </div>
          <div className="fila">
            <label>
              Monto
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
              />
            </label>
            <label>
              Categoría
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
          </div>
          <label>
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} />
          </label>
          {errorTrans && <p className="error" role="alert">{errorTrans}</p>}
          <button type="submit">Guardar {tipo}</button>
        </form>
      </section>

      {/* ---------- Metas de ahorro ---------- */}
      <section className="panel">
        <h2>Metas de ahorro</h2>
        {metas.length === 0 ? (
          <p className="vacio">Aún no tienes metas. Crea la primera, por ejemplo un fondo de emergencia.</p>
        ) : (
          <ul className="metas">
            {metas.map((m) => {
              const ahorrado = totalAhorrado(m);
              const pct = Math.min(100, Math.round((ahorrado / m.objetivo) * 100));
              return (
                <li key={m.id} className="meta">
                  <div className="meta-cabeza">
                    <strong>{m.nombre}</strong>
                    <span>
                      {dinero(ahorrado)} / {dinero(m.objetivo)} · {pct}%
                    </span>
                  </div>
                  <progress value={ahorrado} max={m.objetivo} aria-label={`Progreso de ${m.nombre}`} />
                  {ahorrado >= m.objetivo && <small className="positivo">¡Meta alcanzada!</small>}
                  <div className="meta-acciones">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      placeholder="Monto"
                      aria-label={`Monto para ${m.nombre}`}
                      value={aporte[m.id] ?? ""}
                      onChange={(e) => setAporte({ ...aporte, [m.id]: e.target.value })}
                    />
                    <button onClick={() => moverDinero(m, 1)}>Agregar</button>
                    <button className="sec" onClick={() => moverDinero(m, -1)}>Retirar</button>
                    <button
                      className="peligro"
                      onClick={() =>
                        confirm(`¿Eliminar la meta "${m.nombre}"? Se pierde su historial de aportes.`) &&
                        eliminarMeta(uid, m.id)
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                  {errorMeta?.id === m.id && <p className="error" role="alert">{errorMeta.texto}</p>}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={guardarMeta} className="form nueva-meta">
          <h3>Nueva meta</h3>
          <div className="fila">
            <label>
              Nombre
              <input
                value={metaNombre}
                onChange={(e) => setMetaNombre(e.target.value)}
                placeholder="Fondo de emergencia"
                required
              />
            </label>
            <label>
              Objetivo
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={metaObjetivo}
                onChange={(e) => setMetaObjetivo(e.target.value)}
                required
              />
            </label>
          </div>
          <button type="submit">Crear meta</button>
        </form>
      </section>

      {/* ---------- Reporte por fechas ---------- */}
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

        {reporte.lista.length === 0 && reporte.ahorro === 0 ? (
          <p className="vacio">No hay movimientos en este rango.</p>
        ) : (
          <>
            <Dona
              ingresos={reporte.ingresos}
              gastos={reporte.gastos}
              ahorro={reporte.ahorro}
              centroTitulo="Disponible"
              centroValor={dinero(reporte.disponible)}
              formato={dinero}
            />
            {reporte.lista.length > 0 && (
                <div className="tabla-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Categoría</th>
                        <th>Nota</th>
                        <th>Monto</th>
                        <th><span className="solo-lectores">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.lista.map((t) => (
                        <tr key={t.id}>
                          <td>
                            {new Date(t.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td>{t.categoria}</td>
                          <td>{t.nota}</td>
                          <td className={t.tipo === "ingreso" ? "positivo" : "negativo"}>
                            {t.tipo === "ingreso" ? "+" : "−"}
                            {dinero(t.monto)}
                          </td>
                          <td>
                            <button
                              className="mini"
                              aria-label={`Eliminar ${t.categoria} ${dinero(t.monto)}`}
                              onClick={() => confirm("¿Eliminar esta transacción?") && eliminarTransaccion(uid, t.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
