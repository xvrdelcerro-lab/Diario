import { useState } from "react";
import type { FormEvent } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../core/firebase";

function mensajeError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/email-already-in-use":
      return "Ese correo ya tiene una cuenta. Inicia sesión.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-email":
      return "El correo no tiene un formato válido.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).";
    default:
      return "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.";
  }
}

export default function Login() {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      if (modo === "entrar") await signInWithEmailAndPassword(auth, correo, clave);
      else await createUserWithEmailAndPassword(auth, correo, clave);
    } catch (err) {
      setError(mensajeError((err as { code?: string }).code ?? ""));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <h1>Diario</h1>
      <p>{modo === "entrar" ? "Inicia sesión para ver tu agenda." : "Crea tu cuenta."}</p>
      <form onSubmit={enviar} className="form">
        <label>
          Correo electrónico
          <input
            type="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={enviando}>
          {modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>
      <button
        className="enlace"
        onClick={() => {
          setError("");
          setModo(modo === "entrar" ? "crear" : "entrar");
        }}
      >
        {modo === "entrar" ? "No tengo cuenta" : "Ya tengo cuenta"}
      </button>
    </main>
  );
}
