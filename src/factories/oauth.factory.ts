import { AppleUser } from '../models/oauth/apple-user.model'
import { DiscordUser } from '../models/oauth/discord-user.model'
import { FacebookUser } from '../models/oauth/facebook-user.model'
import { GithubUser } from '../models/oauth/github-user.model'
import { GoogleUser } from '../models/oauth/google-user.model'
import { SpotifyUser } from '../models/oauth/spotify-user.model'
import { ProviderUserMapping } from '../types/oauth.types'

export const providerUserFactory: ProviderUserMapping = {
  facebook: FacebookUser,
  discord: DiscordUser,
  google: GoogleUser,
  spotify: SpotifyUser,
  apple: AppleUser,
  github: GithubUser
}
