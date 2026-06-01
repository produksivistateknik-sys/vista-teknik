import { activityLogger, LogParams } from '../services/activityLogger'

export const useLog = () => {
  const log = async (params: LogParams): Promise<void> => {
    await activityLogger(params)
  }
  return { log }
}
