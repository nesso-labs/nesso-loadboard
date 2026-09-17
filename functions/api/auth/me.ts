import type { AppData } from '../../_lib/auth'
import { json } from '../../_lib/json'
import type { Env } from '../../_lib/mappers'

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ data }) => {
  const { userId, email, role } = data.auth
  return json({ id: userId, email, role })
}
