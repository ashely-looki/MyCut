import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const UNSAVED_DRAFT_KEY = 'mycut-unsaved-creation'

export function useSafeNavigate() {
  const navigate = useNavigate()

  return useCallback((path: string) => {
    const hasUnsavedCreation = sessionStorage.getItem(UNSAVED_DRAFT_KEY) === 'true'

    if (hasUnsavedCreation) {
      const shouldLeave = window.confirm('当前创作还有未保存的修改。确定不保存并离开吗？')
      if (!shouldLeave) return false
      sessionStorage.removeItem(UNSAVED_DRAFT_KEY)
    }

    navigate(path)
    return true
  }, [navigate])
}
