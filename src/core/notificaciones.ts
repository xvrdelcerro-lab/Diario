import { Capacitor } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { dosisProgramadas } from "../modules/medicinas/medicinas.service";
import type { Medicina } from "../modules/medicinas/medicinas.service";

// iOS permite como máximo 64 notificaciones locales pendientes.
const MAX_NOTIFICACIONES = 60;
const DIAS_ADELANTE = 7;
const CANAL = "medicinas";

function idNotificacion(medId: string, fecha: number): number {
  let h = 0;
  const s = `${medId}-${fecha}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

/** En Android 12+ las alarmas a la hora exacta requieren un permiso que el usuario activa a mano. */
export async function estadoAlarmasExactas(): Promise<PermissionState | "no-aplica"> {
  if (Capacitor.getPlatform() !== "android") return "no-aplica";
  const r = await LocalNotifications.checkExactNotificationSetting();
  return r.exact_alarm;
}

/** Abre la pantalla de ajustes de Android donde se activa ese permiso. */
export async function abrirAjusteAlarmasExactas() {
  await LocalNotifications.changeExactNotificationSetting();
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
  await asegurarCanal();

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
      channelId: CANAL,
      extra: { medicinaId: m.id },
    })),
  });
}

// Canal de máxima importancia: la notificación suena, vibra y aparece sobre la pantalla (Android 8+).
async function asegurarCanal() {
  if (Capacitor.getPlatform() !== "android") return;
  await LocalNotifications.createChannel({
    id: CANAL,
    name: "Recordatorios de medicinas",
    description: "Avisos de las tomas de tus medicinas",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });
}

export interface Diagnostico {
  notificaciones: PermissionState;
  exactas: PermissionState | "no-aplica";
  pendientes: number;
  proxima: number | null;
}

/** Resume el estado de las alarmas para mostrarlo en pantalla. */
export async function diagnosticoAlarmas(): Promise<Diagnostico> {
  const permiso = await LocalNotifications.checkPermissions();
  const exactas = await estadoAlarmasExactas();
  const pendientes = await LocalNotifications.getPending();
  const tiempos = pendientes.notifications
    .map((n) => (n.schedule?.at ? new Date(n.schedule.at).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  return {
    notificaciones: permiso.display,
    exactas,
    pendientes: pendientes.notifications.length,
    proxima: tiempos.length > 0 ? Math.min(...tiempos) : null,
  };
}

export async function pedirPermisoNotificaciones() {
  return (await LocalNotifications.requestPermissions()).display;
}

/** Programa una notificación de prueba a los 10 segundos. */
export async function probarAlarma() {
  await asegurarCanal();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 2147480000,
        title: "💊 Prueba de alarma",
        body: "Si ves esto, las alarmas funcionan.",
        schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true },
        channelId: CANAL,
      },
    ],
  });
}
