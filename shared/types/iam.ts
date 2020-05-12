export type User = {
  email: string
  username: string
  uuid: string
}

export type Credentials = {
  accessToken: string
  user: User
}
