type CheckInPoint = {
  id: number;
  weekStart: string;
  weightKg: string | null;
  adherence: number;
  hunger: number;
  satiety: number;
  sleep: number;
  energy: number;
  trainingSessions: number;
};

type GoalItem = {
  id: number;
  title: string;
  initialValue: string;
  currentValue: string;
  targetValue: string;
  unit: string;
  status: string;
};

type GoalPoint = {
  id: number;
  goalId: number;
  value: string;
  createdAt: string;
};

type NumericPoint = { label: string; value: number };

const metricConfig = [
  { key: "adherence", label: "Aderência", suffix: "/5", color: "#ffe900", max: 5 },
  { key: "hunger", label: "Fome", suffix: "/5", color: "#ff8a65", max: 5 },
  { key: "satiety", label: "Saciedade", suffix: "/5", color: "#8dd7bf", max: 5 },
  { key: "sleep", label: "Sono", suffix: "/5", color: "#a7b8ff", max: 5 },
  { key: "energy", label: "Energia", suffix: "/5", color: "#ffc266", max: 5 },
  { key: "trainingSessions", label: "Treinos", suffix: "/sem", color: "#e7e7e7", max: undefined },
] as const;

function shortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function numberValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function pathFor(points: NumericPoint[], width: number, height: number, forcedMax?: number) {
  if (!points.length) return "";
  const values = points.map((point) => point.value);
  let min = forcedMax ? 0 : Math.min(...values);
  let max = forcedMax ?? Math.max(...values);
  if (min === max) {
    min = Math.max(0, min - 1);
    max += 1;
  }
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / (max - min)) * height;
      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function TrendChart({
  points,
  color,
  max,
  large = false,
  valueSuffix = "",
}: {
  points: NumericPoint[];
  color: string;
  max?: number;
  large?: boolean;
  valueSuffix?: string;
}) {
  const width = large ? 720 : 240;
  const height = large ? 190 : 78;
  const path = pathFor(points, width, height, max);
  const values = points.map((point) => point.value);
  const min = max ? 0 : Math.min(...values);
  const ceiling = max ?? Math.max(...values);

  return (
    <div className={`trend-chart ${large ? "trend-chart-large" : ""}`}>
      <svg aria-label={`Evolução de ${points.length} registros`} role="img" viewBox={`-8 -8 ${width + 16} ${height + 16}`}>
        <line className="chart-grid-line" x1="0" x2={width} y1={height} y2={height} />
        <line className="chart-grid-line" x1="0" x2={width} y1={height / 2} y2={height / 2} />
        {path ? <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={large ? 4 : 3} /> : null}
        {points.map((point, index) => {
          const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
          const y = height - ((point.value - min) / ((ceiling - min) || 1)) * height;
          return <circle cx={x} cy={y} fill={color} key={`${point.label}-${index}`} r={large ? 5 : 3.5}><title>{point.label}: {point.value}{valueSuffix}</title></circle>;
        })}
      </svg>
      {points.length ? (
        <div className="chart-axis">
          <span>{points[0].label}</span>
          {points.length > 1 ? <span>{points.at(-1)?.label}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ProgressCharts({
  checkIns,
  goals,
  goalProgress,
  compact = false,
}: {
  checkIns: CheckInPoint[];
  goals: GoalItem[];
  goalProgress: GoalPoint[];
  compact?: boolean;
}) {
  const ordered = checkIns.toSorted((a, b) => a.weekStart.localeCompare(b.weekStart));
  const weightPoints = ordered.flatMap((item) => {
    const value = numberValue(item.weightKg);
    return value === null ? [] : [{ label: shortDate(item.weekStart), value }];
  });
  const firstWeight = weightPoints[0]?.value;
  const lastWeight = weightPoints.at(-1)?.value;
  const weightChange =
    firstWeight !== undefined && lastWeight !== undefined
      ? lastWeight - firstWeight
      : null;
  const averageAdherence = ordered.length
    ? ordered.reduce((sum, item) => sum + item.adherence, 0) / ordered.length
    : null;
  const latest = ordered.at(-1);

  if (!ordered.length && !goals.length) {
    return (
      <div className="charts-empty">
        <strong>Os gráficos serão formados a partir dos próximos registros.</strong>
        <p>Após o primeiro check-in ou atualização de meta, a evolução aparecerá automaticamente aqui.</p>
      </div>
    );
  }

  return (
    <div className={`progress-charts ${compact ? "is-compact" : ""}`}>
      <div className="chart-summary-grid">
        <article>
          <span>Check-ins</span>
          <strong>{ordered.length}</strong>
          <p>registro(s) no período</p>
        </article>
        <article>
          <span>Variação de peso</span>
          <strong>{weightChange === null ? "—" : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1).replace(".", ",")} kg`}</strong>
          <p>{weightPoints.length > 1 ? "desde o primeiro registro" : "aguardando novo registro"}</p>
        </article>
        <article>
          <span>Aderência média</span>
          <strong>{averageAdherence === null ? "—" : `${averageAdherence.toFixed(1).replace(".", ",")}/5`}</strong>
          <p>média dos check-ins</p>
        </article>
        <article>
          <span>Treinos recentes</span>
          <strong>{latest ? latest.trainingSessions : "—"}</strong>
          <p>na última semana</p>
        </article>
      </div>

      <section className="weight-chart-card">
        <div className="chart-card-heading">
          <div><span>Composição do acompanhamento</span><h2>Evolução do peso</h2></div>
          <strong>{lastWeight !== undefined ? `${lastWeight.toFixed(1).replace(".", ",")} kg` : "Sem dados"}</strong>
        </div>
        {weightPoints.length ? (
          <TrendChart color="#ffe900" large points={weightPoints} valueSuffix=" kg" />
        ) : (
          <p className="chart-no-data">O peso é opcional no check-in. Nenhum valor foi informado até o momento.</p>
        )}
      </section>

      <section className="wellbeing-chart-section">
        <div className="chart-section-heading">
          <span>Indicadores semanais</span>
          <h2>Rotina, sintomas e desempenho</h2>
          <p>Analise tendências ao longo das semanas; uma oscilação isolada não define o resultado do acompanhamento.</p>
        </div>
        <div className="metric-chart-grid">
          {metricConfig.map((metric) => {
            const points = ordered.map((item) => ({
              label: shortDate(item.weekStart),
              value: item[metric.key],
            }));
            const current = points.at(-1)?.value;
            return (
              <article key={metric.key}>
                <header>
                  <div><i style={{ background: metric.color }} /><span>{metric.label}</span></div>
                  <strong>{current ?? "—"}{current !== undefined ? metric.suffix : ""}</strong>
                </header>
                {points.length ? <TrendChart color={metric.color} max={metric.max} points={points} valueSuffix={metric.suffix} /> : null}
              </article>
            );
          })}
        </div>
      </section>

      {goals.length ? (
        <section className="goal-chart-section">
          <div className="chart-section-heading">
            <span>Metas definidas em conjunto</span>
            <h2>Progresso dos objetivos</h2>
          </div>
          <div className="goal-chart-grid">
            {goals.map((goal) => {
              const history = goalProgress
                .filter((point) => point.goalId === goal.id)
                .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
                .flatMap((point) => {
                  const value = numberValue(point.value);
                  return value === null
                    ? []
                    : [{
                        label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(point.createdAt)),
                        value,
                      }];
                });
              const initial = numberValue(goal.initialValue);
              const current = numberValue(goal.currentValue);
              const target = numberValue(goal.targetValue);
              const percent = initial !== null && current !== null && target !== null && initial !== target
                ? Math.max(0, Math.min(100, Math.round(((current - initial) / (target - initial)) * 100)))
                : 0;
              return (
                <article key={goal.id}>
                  <header><span>{goal.status === "achieved" ? "Meta alcançada" : "Meta em acompanhamento"}</span><b>{percent}%</b></header>
                  <h3>{goal.title}</h3>
                  <div className="goal-mini-bar"><i style={{ width: `${percent}%` }} /></div>
                  <p>{goal.currentValue} {goal.unit} atuais · objetivo de {goal.targetValue} {goal.unit}</p>
                  {history.length ? <TrendChart color="#ffe900" points={history} valueSuffix={` ${goal.unit}`} /> : <small>O histórico aparecerá após a primeira atualização.</small>}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
