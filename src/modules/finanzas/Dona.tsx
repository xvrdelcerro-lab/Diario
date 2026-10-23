interface Props {
  ingresos: number;
  gastos: number;
  ahorro: number;
  centroTitulo: string;
  centroValor: string;
  formato: (n: number) => string;
}

// Dona dibujada con SVG: cada arco mide su porcentaje del total (círculo de perímetro 100).
export default function Dona({ ingresos, gastos, ahorro, centroTitulo, centroValor, formato }: Props) {
  const partes = [
    { clave: "ingreso", nombre: "Ingresos", total: ingresos },
    { clave: "gasto", nombre: "Gastos", total: gastos },
    { clave: "ahorro", nombre: "Ahorro", total: ahorro },
  ].map((p) => ({ ...p, valor: Math.max(p.total, 0) })); // un retiro neto no resta del gráfico

  const suma = partes.reduce((s, p) => s + p.valor, 0);
  if (suma === 0) return <p className="vacio">Sin datos para graficar.</p>;

  let acumulado = 0;
  const arcos = partes.map((p) => {
    const pct = (p.valor / suma) * 100;
    const inicio = acumulado;
    acumulado += pct;
    return { ...p, pct, inicio };
  });
  const conValor = arcos.filter((a) => a.pct > 0);
  const hueco = conValor.length > 1 ? 0.6 : 0;

  const descripcion = arcos
    .map((a) => `${a.nombre} ${formato(a.total)}, ${Math.round(a.pct)}%`)
    .join("; ");

  return (
    <div className="dona">
      <div className="dona-grafico">
        <svg viewBox="0 0 42 42" role="img" aria-label={`Distribución: ${descripcion}`}>
          <circle className="dona-fondo" cx="21" cy="21" r="15.9155" />
          {conValor.map((a) => {
            const largo = Math.max(a.pct - hueco, 0.1);
            return (
              <circle
                key={a.clave}
                className={`dona-arco ${a.clave}`}
                cx="21"
                cy="21"
                r="15.9155"
                strokeDasharray={`${largo} ${100 - largo}`}
                strokeDashoffset={25 - a.inicio}
              />
            );
          })}
        </svg>
        <div className="dona-centro">
          <small>{centroTitulo}</small>
          <strong>{centroValor}</strong>
        </div>
      </div>

      <ul className="dona-leyenda">
        {arcos.map((a) => (
          <li key={a.clave}>
            <span className={`punto ${a.clave}`} aria-hidden="true" />
            <span className="dona-nombre">{a.nombre}</span>
            <span className="dona-total">{formato(a.total)}</span>
            <span className="dona-pct">{Math.round(a.pct)}%</span>
          </li>
        ))}
      </ul>
      <small className="dona-nota">Porcentajes sobre la suma de ingresos, gastos y ahorro.</small>
    </div>
  );
}
