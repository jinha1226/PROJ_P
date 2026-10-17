import type { ClientMsg, ServerMsg } from '../ws/types'
import { MessageHold } from '../ws/message-hold'
import { saveSession } from './session'

export interface PasswordLoginConn {
  send(msg: ClientMsg): void
  onMessage: (msg: ServerMsg) => void
  onLoginCookie: (cookie: string, expiresDays: number) => void
}

export interface PasswordLoginRequest {
  wsUrl: string
  username: string
  password: string
}

export interface PasswordLoginCallbacks {
  onSuccess: (username: string, flush: () => void) => void
  onFail: (message: string) => void
}

export function passwordLogin(conn: PasswordLoginConn, req: PasswordLoginRequest, cb: PasswordLoginCallbacks): void {
  const held = new MessageHold()
  const pump = (msg: ServerMsg): void => {
    if (msg.msg === 'login_success') {
      conn.onLoginCookie = (cookie, days) => saveSession(req.wsUrl, msg.username, cookie, days)
      conn.send({ msg: 'set_login_cookie' })
      cb.onSuccess(msg.username, () => held.replay(conn, pump))
    } else if (msg.msg === 'login_fail') {
      cb.onFail(msg.reason || 'Incorrect username or password.')
    } else {
      held.hold(msg)
    }
  }
  conn.onMessage = pump
  conn.send({ msg: 'login', username: req.username, password: req.password })
}
