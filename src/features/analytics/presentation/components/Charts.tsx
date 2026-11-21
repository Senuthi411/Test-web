import { useId, type ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { Card } from '@/shared/components'
import { cx } from '@/shared/utilities/classNames'
import { DISEASES, type Observation } from '../../domain/models'
import { axisMax, diseaseColors } from './chartTheme'
import styles from './analytics.module.css'

export interface Series {
  name: string
  color: string
  values: number[]
}

/** Whole-number axis steps where possible (12 → 0, 3, 6, 9, 12 rather than 2.4, 4.8 …). */
const tickSteps = (top: number) => [5, 4, 3, 6].find((steps) => Number.isInteger(top / steps)) ?? 5

/** Show every k-th axis label so dense charts stay readable (all values remain in the data table). */
const labelStride = (count: number, maxLabels: number) => Math.max(1, Math.ceil(count / maxLabels))
// When thinned, a label is shown only if a full stride of columns follows it, so it never runs past the chart edge.
const minor = (index: number, stride: number) => stride > 1 && index % stride !== 0

export interface ChartProps {
  title: string
  labels: string[]
  series: Series[]
  max?: number
  line?: boolean
  area?: boolean
  /** Full labels for the accessible description and data table (e.g. week ranges). */
  dataLabels?: string[]
  /** Thin x-axis labels (time axes only; category axes always show every label). */
  thinLabels?: boolean
  wide?: boolean
}

/** Bar or line chart drawn from the records. Every value is also in the "View chart data" table. */
export function Chart({ title, labels, series, max = 15, line = false, area = false, dataLabels, thinLabels = false, wide = false }: ChartProps) {
  const id = useId()
  const yMax = axisMax(series.flatMap((item) => item.values), max)
  const steps = tickSteps(yMax)
  const width = 960
  const height = 300
  const full = dataLabels ?? labels
  const longLabels = labels.some((label) => label.length > 7)
  const stride = thinLabels ? labelStride(labels.length, longLabels ? 8 : 12) : 1
  const strideSm = thinLabels ? labelStride(labels.length, longLabels ? 4 : 6) : 1
  const roomy = (index: number, step: number) => step === 1 || index + step <= labels.length
  const x = (index: number) => ((index + 0.5) * width) / Math.max(labels.length, 1)
  const y = (value: number) => height - (value / yMax) * height

  return (
    <div className={cx(styles.chart, wide && styles.wideChart)}>
      <div className={styles.chartVisual} role="img" aria-labelledby={id}>
        <span id={id} className="tl-visually-hidden">
          {title}. {series.map((item) => `${item.name}: ${full.map((label, index) => `${label} ${item.values[index] ?? 0}`).join(', ')}.`).join(' ')}
        </span>
        <div className={styles.chartY} aria-hidden="true">
          {Array.from({ length: steps + 1 }, (_, index) => (
            <span key={index}>{Number(((yMax * (steps - index)) / steps).toFixed(1))}</span>
          ))}
        </div>
        <div className={styles.chartBody}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: steps + 1 }, (_, index) => (
              <line key={index} x1="0" x2={width} y1={(height * index) / steps} y2={(height * index) / steps} stroke="#e5ebe5" />
            ))}
            {series.map((item, seriesIndex) =>
              line ? (
                <g key={item.name}>
                  {area && item.values.length > 0 && (
                    <polygon
                      fill={item.color}
                      opacity=".12"
                      points={`${x(0)},${height} ${item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} ${x(item.values.length - 1)},${height}`}
                    />
                  )}
                  <polyline fill="none" stroke={item.color} strokeWidth="3" points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />
                  {item.values.map((value, index) => (
                    <circle key={index} cx={x(index)} cy={y(value)} r="4" fill="white" stroke={item.color}>
                      <title>{`${full[index]}: ${value}`}</title>
                    </circle>
                  ))}
                </g>
              ) : (
                <g key={item.name}>
                  {item.values.map((value, index) => {
                    const group = width / Math.max(labels.length, 1)
                    const barWidth = Math.min(45, (group * 0.6) / series.length)
                    return (
                      <rect
                        key={index}
                        x={(index + 0.5) * group + (seriesIndex - series.length / 2) * barWidth}
                        y={y(value)}
                        width={Math.max(1, barWidth - 3)}
                        height={(value / yMax) * height}
                        rx="3"
                        fill={item.color}
                      >
                        <title>{`${item.name} · ${full[index]}: ${value}`}</title>
                      </rect>
                    )
                  })}
                </g>
              ),
            )}
          </svg>
          <div
            className={cx(styles.chartX, stride > 1 && styles.xThinned, strideSm > 1 && styles.xThinnedSm)}
            style={{ gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0,1fr))` }}
            aria-hidden="true"
          >
            {labels.map((label, index) => (
              <span
                key={index}
                className={cx((minor(index, stride) || !roomy(index, stride)) && styles.xMinor, (minor(index, strideSm) || !roomy(index, strideSm)) && styles.xMinorSm)}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {series.length > 1 && (
        <div className={styles.legend}>
          {series.map((item) => (
            <span key={item.name}>
              <i className={styles.swatch} style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}
      <details className={styles.chartData}>
        <summary>View chart data</summary>
        <table>
          <caption className="tl-visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Period / group</th>
              {series.map((item) => (
                <th scope="col" key={item.name}>
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((_label, index) => (
              <tr key={index}>
                <th scope="row">{full[index]}</th>
                {series.map((item) => (
                  <td key={item.name}>{item.values[index] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/** Card whose whole surface links to a related report (keyboard: the link is a separate tab stop). */
export function NavigableCard({ title, action, to, label, className, children }: { title: string; action?: ReactNode; to: To; label: string; className?: string; children: ReactNode }) {
  return (
    <Card title={title} action={action ? <div className={styles.aboveLink}>{action}</div> : undefined} className={cx(styles.navigable, className)}>
      {children}
      <Link to={to} className={styles.cardLink} aria-label={label} />
    </Card>
  )
}

export function DiseaseDonut({
  observations,
  title = 'Suspected disease distribution',
  to,
  navigationLabel = 'View Disease Distribution',
}: {
  observations: Observation[]
  title?: string
  to?: To
  navigationLabel?: string
}) {
  const counts = DISEASES.map((name) => observations.filter((item) => item.suspectedDisease === name).length)
  const total = observations.length
  let start = 0
  const gradient = counts
    .map((count, index) => {
      const from = start
      start += total ? (count / total) * 100 : 0
      return `${diseaseColors[index]} ${from}% ${start}%`
    })
    .join(', ')
  const body = (
    <>
      <div className={styles.donut} role="img" aria-label={`${total} observations. ${DISEASES.map((name, index) => `${name}: ${counts[index]}`).join(', ')}`}>
        <div className={styles.donutRing} style={{ background: total ? `conic-gradient(${gradient})` : 'var(--tl-bg-neutral-soft)' }} />
        <div className={styles.donutLabel}>
          <strong>{total}</strong>
          <span>observations</span>
        </div>
      </div>
      <ul className={styles.diseaseLegend}>
        {DISEASES.map((name, index) => (
          <li key={name}>
            <i className={styles.swatch} style={{ background: diseaseColors[index] }} />
            <span>{name}</span>
            <strong>
              {counts[index]} · {total ? Math.round((counts[index] / total) * 100) : 0}%
            </strong>
          </li>
        ))}
      </ul>
    </>
  )
  return to ? (
    <NavigableCard title={title} to={to} label={navigationLabel}>
      {body}
    </NavigableCard>
  ) : (
    <Card title={title}>{body}</Card>
  )
}
