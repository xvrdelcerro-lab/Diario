import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./core/firebase";
import { AuthProvider, useAuth } from "./core/auth";
import Login from "./components/Login";
import Medicinas from "./modules/medicinas/Medicinas";
import Pendientes from "./modules/pendientes/Pendientes";
import Eventos from "./modules/eventos/Eventos";
import Proyectos from "./modules/proyectos/Proyectos";
import Finanzas from "./modules/finanzas/Finanzas";

// Para sumar un módulo: créalo en src/modules/ y agrégalo aquí.
const MODULOS = [
  { id: "medicinas", titulo: "Medicinas", pantalla: <Medicinas /> },
  { id: "eventos", titulo: "Eventos", pantalla: <Eventos /> },
  { id: "pendientes", titulo: "Pendientes", pantalla: <Pendientes /> },
  { id: "proyectos", titulo: "Proyectos", pantalla: <Proyectos /> },
  { id: "finanzas", titulo: "Finanzas", pantalla: <Finanzas /> },
];

function Contenido() {
  const { user, cargando } = useAuth();
  const [activo, setActivo] = useState("medicinas");

  if (cargando) return <p className="vacio centrado">Cargando…</p>;
  if (!user) return <Login />;

  const modulo = MODULOS.find((m) => m.id === activo)!;

  return (
    <div className="app">
      <header>
        <h1>Diario</h1>
        <button className="sec" onClick={() => signOut(auth)}>
          Cerrar sesión
        </button>
      </header>
      <nav aria-label="Módulos">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            className={m.id === activo ? "tab activa" : "tab"}
            onClick={() => setActivo(m.id)}
          >
            {m.titulo}
          </button>
        ))}
      </nav>
      <main>
        {modulo.pantalla ?? (
          <p className="vacio">El módulo {modulo.titulo} se construye en el siguiente paso.</p>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  );
}
