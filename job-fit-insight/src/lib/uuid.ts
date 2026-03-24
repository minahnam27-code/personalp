// 클라이언트/서버 환경에서 공통으로 안전한 ID 생성
type CryptoLike = { randomUUID?: () => string }

function fallbackId() {
  // RFC를 엄밀히 따를 필요는 없고, 충돌 가능성을 낮추는 목적입니다.
  const t = Date.now().toString(16)
  const r1 = Math.random().toString(16).slice(2)
  const r2 = Math.random().toString(16).slice(2)
  return `${t}-${r1}-${r2}`
}

export function newId() {
  const c = globalThis.crypto as unknown as CryptoLike | undefined
  if (c?.randomUUID) return c.randomUUID()
  return fallbackId()
}

