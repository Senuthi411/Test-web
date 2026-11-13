import { iconData, type IconName } from './iconData'

export interface IconProps {
  name: IconName
  /** Rendered size in CSS pixels. Defaults to the Figma master size ÷ 2. */
  size?: number
  className?: string
  /** Accessible label. When omitted the icon is decorative and hidden from assistive tech. */
  label?: string
}

export function Icon({ name, size, className, label }: IconProps) {
  const definition = iconData[name]
  const px = size ?? definition.designSize / 2
  return (
    <svg
      className={className}
      width={px}
      height={px}
      viewBox={definition.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      // Static, build-time SVG markup generated from the Figma icon masters.
      dangerouslySetInnerHTML={{ __html: definition.body }}
    />
  )
}
