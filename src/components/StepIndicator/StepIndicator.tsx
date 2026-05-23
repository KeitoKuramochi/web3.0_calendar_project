import styles from "./StepIndicator.module.css"

const STEPS = [
  { label: "リクエスト作成" },
  { label: "相談先・日程選択" },
  { label: "メッセージ確認" },
]

interface Props {
  current: 1 | 2 | 3
}

export default function StepIndicator({ current }: Props) {
  return (
    <div className={styles.wrapper}>
      {STEPS.map((step, i) => {
        const stepNum = i + 1
        const isDone = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={i} className={styles.stepGroup}>
            <div className={`${styles.step} ${isDone ? styles.done : ""} ${isActive ? styles.active : ""}`}>
              <div className={styles.circle}>
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span>{stepNum}</span>
                )}
              </div>
              <span className={styles.label}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`${styles.connector} ${isDone ? styles.connectorDone : ""}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
