import leaf from './assets/leaf.svg'
import spot1 from './assets/spot-1.svg'
import spot2 from './assets/spot-2.svg'
import spot3 from './assets/spot-3.svg'
import spot4 from './assets/spot-4.svg'
import styles from './capture.module.css'

export const pieces = [
  { src: leaf, className: styles.leaf, x: 563.4, y: 85.4, w: 1049.2, h: 1049.2 },
  { src: spot1, className: styles.spot1, x: 1012.75, y: 437.15, w: 150.507, h: 120.405 },
  { src: spot2, className: styles.spot2, x: 1248.05, y: 613.45, w: 115.093, h: 92.075 },
  { src: spot3, className: styles.spot3, x: 934.93, y: 687.73, w: 88.533, h: 70.827 },
  { src: spot4, className: styles.spot4, x: 1226.67, y: 391.59, w: 70.827, h: 56.661 },
]
