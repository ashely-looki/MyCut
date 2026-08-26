import { useSearchParams } from 'react-router-dom'

import ProjectsPage from '@/pages/ProjectsPage'
import ScriptLibraryPage from '@/pages/ScriptLibraryPage'

type ManageTab = 'scripts' | 'projects'

const ManagePage = () => {
  const [searchParams] = useSearchParams()
  const activeTab: ManageTab = searchParams.get('tab') === 'projects' ? 'projects' : 'scripts'

  return activeTab === 'scripts' ? <ScriptLibraryPage /> : <ProjectsPage />
}

export default ManagePage
