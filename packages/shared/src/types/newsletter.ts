// Newsletter type definitions
export interface Newsletter {
  id: string
  userId: string
  senderId: string
  subject: string
  receivedAt: number
  r2Key: string
  isRead: boolean
  isHidden: boolean
  isPrivate: boolean
}

export interface Sender {
  id: string
  email: string
  name?: string
  domain: string
  isPrivate: boolean
}
