import { authProviders } from '../config/authProviders'
import { AppleUser } from '../models/oauth/apple-user.model'
import { DiscordUser } from '../models/oauth/discord-user.model'
import { FacebookUser } from '../models/oauth/facebook-user.model'
import { GithubUser } from '../models/oauth/github-user.model'
import { GoogleUser } from '../models/oauth/google-user.model'
import { SpotifyUser } from '../models/oauth/spotify-user.model'

export type AuthProviderType = (typeof authProviders)[keyof typeof authProviders]

export interface OAuthUserType {
  _id: string
  _email: string
  _name?: string
  providerType: AuthProviderType
}

export interface AppleUserType {
  sub: string
  email?: string
  name?: string
}

export interface DiscordUserType {
  id: string
  email: string
  username: string
}

export interface FacebookUserType {
  id: string
  email: string
  first_name: string
  last_name: string
}

export interface GithubUserType {
  id: number
  email: string
  name: string
}

export interface GoogleUserType {
  id: string
  email: string
  name: string
}

export interface SpotifyUserType {
  id: string
  email: string
  display_name: string
}

export interface OauthUserTypes {
  facebook: FacebookUserType
  discord: DiscordUserType
  google: GoogleUserType
  spotify: SpotifyUserType
  apple: AppleUserType
  github: GithubUserType
}

export type ProviderUserMapping = {
  [key in AuthProviderType]: new (
    user: OauthUserTypes[key]
  ) => FacebookUser | DiscordUser | GoogleUser | SpotifyUser | AppleUser | GithubUser
}
