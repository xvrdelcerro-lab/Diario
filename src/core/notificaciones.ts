import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { dosisProgramadas } from "../modules/medicinas/medicinas.service";
import type { Medicina } from "../modules/medicinas/medicinas.service";

// iOS permite como máximo 64 notificaciones locales pendientes.
const MAX_NOTIFICACIONES = 60;
const DIAS_ADELANTE = 7;

function idNotificacion(medId: string, fecha: number): number {
  let h = 0;
  const s = `${medId}-${fecha}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

/**
 * Borra las alarmas pendientes y programa las próximas tomas de todas las
 * medicinas activas. Llámala al abrir la app y cada vez que cambie la lista.
 * En web (navegador) no hace nada: allí no hay alarmas con la app cerrada.
 */
export async function reprogramarAlarmas(meds: Medicina[]) {
  if (!Capacitor.isNativePlatform()) return;

  const permiso = await LocalNotifications.requestPermissions();
  if (permiso.display !== "granted") return;

  const pendientes = await LocalNotifications.getPending();
  if (pendientes.notifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: pendientes.notifications.map((n) => ({ id: n.id })),
    });
  }

  const ahora = Date.now();
  const horizonte = ahora + DIAS_ADELANTE * 24 * 3600000;

  const proximas = meds
    .filter((m) => m.activa)
    .flatMap((m) => dosisProgramadas(m, ahora, horizonte).map((t) => ({ m, t })))
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_NOTIFICACIONES);

  if (proximas.length === 0) return;

  await LocalNotifications.schedule({
    notifications: proximas.map(({ m, t }) => ({
      id: idNotificacion(m.id, t),
      title: `💊 ${m.nombre}`,
      body: `Dosis: ${m.dosis}`,
      schedule: { at: new Date(t), allowWhileIdle: true },
      extra: { medicinaId: m.id },
    })),
  });
}
