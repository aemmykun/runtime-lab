import { useQuery } from '@tanstack/react-query';
import { ensureDefaultProject, listExperiments, listHistory, listRuns } from '~/db/repo';

export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: ensureDefaultProject });
export const useRuns = (projectId?: string) => useQuery({ queryKey: ['runs', projectId], queryFn: () => listRuns(projectId) });
export const useExperiments = (projectId?: string) => useQuery({ queryKey: ['experiments', projectId], queryFn: () => listExperiments(projectId) });
export const useHistory = () => useQuery({ queryKey: ['history'], queryFn: () => listHistory() });
