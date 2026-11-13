import { pieces } from './evidenceAssets'

/** Download the synthetic Figma fixture illustration as JPEG; never mutate stored evidence. */
export async function downloadEvidence(imageId = 'IMG-005') {
  const canvas = document.createElement('canvas')
  canvas.width = 2176; canvas.height = 1220
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image download is not available in this browser.')
  const angle = 166 * Math.PI / 180
  const dx = Math.sin(angle); const dy = -Math.cos(angle)
  const length = Math.abs(canvas.width * dx) + Math.abs(canvas.height * dy)
  const gradient = context.createLinearGradient(canvas.width / 2 - dx * length / 2, canvas.height / 2 - dy * length / 2, canvas.width / 2 + dx * length / 2, canvas.height / 2 + dy * length / 2)
  gradient.addColorStop(0, '#6ba84a'); gradient.addColorStop(0.77, '#1f4a2a')
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height)
  for (const piece of pieces) {
    const image = new Image(); image.src = piece.src
    await image.decode()
    context.drawImage(image, piece.x, piece.y, piece.w, piece.h)
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create the fixture image.')), 'image/jpeg', 0.95))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `${imageId}-fixture-original.jpg`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
