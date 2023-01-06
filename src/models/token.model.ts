export interface TokenResponse {
  access: {
    token: string
    expires: Date
  }
  refresh: {
    token: string
    expires: Date
  }
}
