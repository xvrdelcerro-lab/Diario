import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";
import {
  diagnosticoAlarmas,
  pedirPermisoNotificaciones,
  probarAlarma,
} from "../../core/notificaciones";
import type { Diagnostico } from "../../core/notificaciones";

const textoPermiso = (p: PermissionState | "no-aplica") =>
  p === "granted" ? "Permitidas" : p === "denied" ? "Bloqueadas" : p === "no-aplica" ? "No aplica" : "Sin decidir";

// Solo aparece en la app del móvil. Sirve para saber por qué una alarma no suena.
export default function DiagnosticoAlarmas() {
  const nativa = Capacitor.isNativePlatform();
  const [d, setD] = useState<Diagnostico | null>(null);
  const [mensaje, setMensaje] = useState("");

  const actualizar = useCallback(() => {
    diagnosticoAlarmas()
      .then(setD)
      .catch((e) => setMensaje(`No se pudo leer el estado: ${String(e)}`));
  }, []);

  useEffect(() => {
    if (nativa) actualizar();
  }, [nativa, actualizar]);

  if (!nativa) return null;

  async function probar() {
    try {
      await probarAlarma();
      setMensaje("Listo. Cierra la app deslizándola y espera unos 10 segundos.");
      actualizar();
    } catch (e) {
      setMensaje(`No se pudo programar la prueba: ${String(e)}`);
    }
  }

  async function pedir() {
    try {
      const r = await pedirPermisoNotificaciones();
      setMensaje(
        r === "granted"
          ? "Notificaciones permitidas."
          : "Android no volvió a preguntar. Actívalas en Ajustes → Apps → Diario → Notificaciones."
      );
      actualizar();
    } catch (e) {
      setMensaje(`Error: ${String(e)}`);
    }
  }

  return (
    <section className="panel">
      <h2>Estado de las alarmas</h2>
      {d ? (
        <ul className="diag">
          <li>Notificaciones: <strong>{textoPermiso(d.notificaciones)}</strong></li>
          <li>Alarmas exactas: <strong>{textoPermiso(d.exactas)}</strong></li>
          <li>Alarmas programadas: <strong>{d.pendientes}</strong></li>
          <li>
            Próxima alarma:{" "}
            <strong>
              {d.proxima
                ? new Date(d.proxima).toLocaleString("es-MX", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "ninguna"}
            </strong>
          </li>
        </ul>
      ) : (
        <p className="vacio">Leyendo estado…</p>
      )}
      {mensaje && <p role="status">{mensaje}</p>}
      <div className="acciones diag-botones">
        {d && d.notificaciones !== "granted" && <button onClick={pedir}>Pedir permiso</button>}
        <button onClick={probar}>Probar alarma (10 s)</button>
        <button className="sec" onClick={actualizar}>Actualizar</button>
      </div>
    </section>
  );
}
