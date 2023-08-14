import { AppleUser } from '../models/oauth/appleUser.model'
import { DiscordUser } from '../models/oauth/discordUser.model'
import { FacebookUser } from '../models/oauth/facebookUser.model'
import { GithubUser } from '../models/oauth/githubUser.model'
import { GoogleUser } from '../models/oauth/googleUser.model'
import { SpotifyUser } from '../models/oauth/spotifyUser.model'
import { ProviderUserMapping } from '../types/oauth.types'

export const providerUserFactory: ProviderUserMapping = {
  facebook: FacebookUser,
  discord: DiscordUser,
  google: GoogleUser,
  spotify: SpotifyUser,
  apple: AppleUser,
  github: GithubUser
}
