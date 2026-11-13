/** Props for the panel belonging to the selected tab. */
export function tabPanelProps(idBase: string, selected: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idBase}-panel-${selected}`,
    'aria-labelledby': `${idBase}-tab-${selected}`,
    tabIndex: 0,
  }
}
